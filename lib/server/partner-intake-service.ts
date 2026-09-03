import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerDeclineSchema } from "@/lib/recovery/partner-intake-schema";
import {
  PartnerAuthError,
  assertFreshPartnerTimestamp,
  readPartnerAuthHeaders,
  resolvePartnerSecret,
  verifyPartnerRequestSignature,
} from "@/lib/server/partner-auth";
import {
  findPartnerIntakeByIdempotency,
  findPartnerIntakeByNonce,
  getPartnerCredentialByKey,
  getPartnerIntakeFeatureEnabled,
  insertPartnerIntakeSession,
} from "@/lib/server/partner-intake-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 8 * 1024;
const TOKEN_TTL_MS = 15 * 60 * 1000;

export type PartnerIntakeFailure =
  | "invalid_payload"
  | "authentication_failed"
  | "intake_disabled"
  | "replay_detected"
  | "rate_limited";

export class PartnerIntakeError extends Error {
  constructor(
    public readonly failure: PartnerIntakeFailure,
    public readonly status: number,
  ) {
    super(failure);
    this.name = "PartnerIntakeError";
  }
}

export interface PartnerIntakeRateLimitHook {
  (admin: SupabaseClient, partnerId: string, now: Date): Promise<boolean>;
}

const allowPartnerIntake: PartnerIntakeRateLimitHook = async () => true;

function credentialIsUsable(
  credential: Awaited<ReturnType<typeof getPartnerCredentialByKey>>,
  now: Date,
) {
  if (!credential) return false;
  if (!credential.credentialEnabled) return false;
  if (!credential.partnerEnabled || !credential.partnerSandboxEnabled) return false;
  if (Date.parse(credential.validFrom) > now.getTime()) return false;
  if (credential.expiresAt && Date.parse(credential.expiresAt) <= now.getTime()) return false;
  return true;
}

export async function processPartnerDeclineIntake(input: {
  bodyText: string;
  headers: Headers;
  now?: Date;
  rateLimitHook?: PartnerIntakeRateLimitHook;
}) {
  const now = input.now ?? new Date();

  if (Buffer.byteLength(input.bodyText, "utf8") > MAX_BODY_BYTES) {
    throw new PartnerIntakeError("invalid_payload", 400);
  }

  const parsedJson = (() => {
    try {
      return JSON.parse(input.bodyText) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = partnerDeclineSchema.safeParse(parsedJson);
  if (!parsed.success) throw new PartnerIntakeError("invalid_payload", 400);

  let auth;
  try {
    auth = readPartnerAuthHeaders(input.headers);
  } catch {
    throw new PartnerIntakeError("authentication_failed", 401);
  }

  const admin = createAdminSupabaseClient();
  const intakeEnabled = await getPartnerIntakeFeatureEnabled(admin);
  if (!intakeEnabled) throw new PartnerIntakeError("intake_disabled", 409);

  const credential = await getPartnerCredentialByKey(admin, auth.credentialKey);
  if (!credentialIsUsable(credential, now) || !credential) {
    throw new PartnerIntakeError("authentication_failed", 401);
  }

  try {
    assertFreshPartnerTimestamp(auth.timestamp, now);
    const secret = resolvePartnerSecret(credential.secretReference);
    verifyPartnerRequestSignature(input.bodyText, auth, secret);
  } catch (error) {
    if (error instanceof PartnerAuthError) {
      throw new PartnerIntakeError("authentication_failed", 401);
    }
    throw error;
  }

  const rateLimitAllowed = await (input.rateLimitHook ?? allowPartnerIntake)(
    admin,
    credential.partnerId,
    now,
  );
  if (!rateLimitAllowed) throw new PartnerIntakeError("rate_limited", 429);

  const [nonceReplay, idempotentReplay] = await Promise.all([
    findPartnerIntakeByNonce(admin, credential.partnerId, auth.nonce),
    findPartnerIntakeByIdempotency(admin, credential.partnerId, auth.idempotencyKey),
  ]);
  if (nonceReplay || idempotentReplay) {
    throw new PartnerIntakeError("replay_detected", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenExpiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();
  const reasonKnown = parsed.data.declineReasonProvided && Boolean(parsed.data.declineReasonCode);

  try {
    await insertPartnerIntakeSession(admin, {
      partnerId: credential.partnerId,
      credentialId: credential.credentialId,
      returnContractId: null,
      environment: "sandbox",
      originReference: parsed.data.originReference,
      productCategory: parsed.data.productCategory,
      declinedAt: parsed.data.declinedAt,
      declineReasonCode: reasonKnown ? parsed.data.declineReasonCode : null,
      declineReasonSource: reasonKnown ? "partner" : "unknown",
      attributionKey: parsed.data.attributionKey ?? null,
      additionalSupportMayBeNeeded: parsed.data.additionalSupportMayBeNeeded ?? null,
      disclosureVersion: parsed.data.disclosureVersion ?? null,
      consentVersion: parsed.data.consentVersion ?? null,
      idempotencyKey: auth.idempotencyKey,
      nonce: auth.nonce,
      requestTimestamp: auth.timestamp,
      tokenHash,
      tokenExpiresAt,
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (code === "23505") throw new PartnerIntakeError("replay_detected", 409);
    throw error;
  }

  return {
    handoffUrl: `/recovery/handoff/${token}`,
    expiresAt: tokenExpiresAt,
  };
}

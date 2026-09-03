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
  getPartnerHandoffByTokenHash,
  getPartnerIntakeFeatureEnabled,
  insertPartnerIntakeSession,
  redeemPartnerHandoffAtomically,
  type PartnerHandoffSession,
} from "@/lib/server/partner-intake-repository";
import type { PartnerContextReviewResult } from "@/lib/server/recovery-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 8 * 1024;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const HANDOFF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,120}$/;

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

export type PartnerHandoffFailure = "invalid_review" | "handoff_unavailable";

export class PartnerHandoffError extends Error {
  constructor(
    public readonly failure: PartnerHandoffFailure,
    public readonly status: number,
  ) {
    super(failure);
    this.name = "PartnerHandoffError";
  }
}

export interface PartnerIntakeRateLimitHook {
  (admin: SupabaseClient, partnerId: string, now: Date): Promise<boolean>;
}

export type PartnerHandoffContextAction =
  | "confirm"
  | "correct_reason"
  | "reason_unknown"
  | "decline_optional_reason_use";

export interface PartnerHandoffReview {
  contextAction: PartnerHandoffContextAction;
  correctedReasonCode: string | null;
}

export interface PartnerHandoffPreview {
  partnerDisplayName: string;
  productCategory: PartnerHandoffSession["productCategory"];
  declinedAt: string;
  reason: {
    known: boolean;
    code: string | null;
    source: "partner" | "unknown";
  };
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

function handoffSessionIsUsable(session: PartnerHandoffSession | null, now: Date) {
  if (!session) return false;
  if (session.environment !== "sandbox") return false;
  if (!session.partnerEnabled || !session.partnerSandboxEnabled) return false;
  if (session.consumedAt || session.boundUserId) return false;
  if (Date.parse(session.tokenExpiresAt) <= now.getTime()) return false;
  return true;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function loadUsablePartnerHandoff(
  admin: SupabaseClient,
  token: string,
  now: Date,
) {
  if (!HANDOFF_TOKEN_PATTERN.test(token)) return null;
  if (!(await getPartnerIntakeFeatureEnabled(admin))) return null;
  const session = await getPartnerHandoffByTokenHash(admin, tokenHash(token));
  return handoffSessionIsUsable(session, now) ? session : null;
}

function reviewResult(
  session: PartnerHandoffSession,
  review: PartnerHandoffReview,
): PartnerContextReviewResult {
  if (review.contextAction === "correct_reason") {
    const corrected = review.correctedReasonCode?.trim() ?? "";
    if (!corrected || corrected.length > 160) {
      throw new PartnerHandoffError("invalid_review", 400);
    }
    return {
      declineReasonKnown: true,
      declineReasonCode: corrected,
      declineReasonSource: "customer",
      contextConfirmation: "corrected",
    };
  }

  if (review.contextAction === "reason_unknown") {
    return {
      declineReasonKnown: false,
      declineReasonCode: null,
      declineReasonSource: "unknown",
      contextConfirmation: "unknown",
    };
  }

  if (review.contextAction === "decline_optional_reason_use") {
    return {
      declineReasonKnown: false,
      declineReasonCode: null,
      declineReasonSource: "unknown",
      contextConfirmation: "optional_use_declined",
    };
  }

  if (review.contextAction !== "confirm") {
    throw new PartnerHandoffError("invalid_review", 400);
  }

  const partnerReasonKnown = session.declineReasonSource === "partner" && Boolean(session.declineReasonCode);
  return partnerReasonKnown
    ? {
      declineReasonKnown: true,
      declineReasonCode: session.declineReasonCode,
      declineReasonSource: "partner",
      contextConfirmation: "confirmed",
    }
    : {
      declineReasonKnown: false,
      declineReasonCode: null,
      declineReasonSource: "unknown",
      contextConfirmation: "confirmed",
    };
}

function isAtomicHandoffUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record.code ?? "");
  const message = String(record.message ?? "");
  return code === "23505" || code === "P0001" || message.includes("handoff_unavailable");
}

export async function previewPartnerHandoff(
  token: string,
  now = new Date(),
): Promise<PartnerHandoffPreview | null> {
  const admin = createAdminSupabaseClient();
  const session = await loadUsablePartnerHandoff(admin, token, now);
  if (!session) return null;

  const known = session.declineReasonSource === "partner" && Boolean(session.declineReasonCode);
  return {
    partnerDisplayName: session.partnerDisplayName,
    productCategory: session.productCategory,
    declinedAt: session.declinedAt,
    reason: {
      known,
      code: known ? session.declineReasonCode : null,
      source: known ? "partner" : "unknown",
    },
  };
}

export async function redeemPartnerHandoff(input: {
  token: string;
  userId: string;
  review: PartnerHandoffReview;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const admin = createAdminSupabaseClient();
  const session = await loadUsablePartnerHandoff(admin, input.token, now);
  if (!session) throw new PartnerHandoffError("handoff_unavailable", 410);

  const reviewedContext = reviewResult(session, input.review);
  try {
    return await redeemPartnerHandoffAtomically(admin, {
      sessionId: session.id,
      userId: input.userId,
      declineReasonKnown: reviewedContext.declineReasonKnown,
      declineReasonCode: reviewedContext.declineReasonCode,
      declineReasonSource: reviewedContext.declineReasonSource,
      contextConfirmation: reviewedContext.contextConfirmation,
      now,
    });
  } catch (error) {
    if (isAtomicHandoffUnavailable(error)) {
      throw new PartnerHandoffError("handoff_unavailable", 410);
    }
    throw error;
  }
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
  const hashedToken = tokenHash(token);
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
      tokenHash: hashedToken,
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

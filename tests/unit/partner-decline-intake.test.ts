import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  getPartnerIntakeFeatureEnabled: vi.fn(),
  getPartnerCredentialByKey: vi.fn(),
  findPartnerIntakeByNonce: vi.fn(),
  findPartnerIntakeByIdempotency: vi.fn(),
  findEligibleSandboxReturnContract: vi.fn(),
  insertPartnerIntakeSession: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));
vi.mock("@/lib/server/partner-intake-repository", () => ({
  getPartnerIntakeFeatureEnabled: mocks.getPartnerIntakeFeatureEnabled,
  getPartnerCredentialByKey: mocks.getPartnerCredentialByKey,
  findPartnerIntakeByNonce: mocks.findPartnerIntakeByNonce,
  findPartnerIntakeByIdempotency: mocks.findPartnerIntakeByIdempotency,
  findEligibleSandboxReturnContract: mocks.findEligibleSandboxReturnContract,
  insertPartnerIntakeSession: mocks.insertPartnerIntakeSession,
}));

import { POST } from "@/app/api/partner/declines/route";
import { partnerDeclineSchema } from "@/lib/recovery/partner-intake-schema";

const SECRET = "test-partner-secret-that-is-long-enough";
const NOW = new Date("2026-09-03T06:30:00.000Z");
const TIMESTAMP = NOW.toISOString();

const validPayload = {
  originReference: "application-abc-123",
  productCategory: "credit_card",
  declinedAt: "2026-09-02T15:30:00.000Z",
  declineReasonProvided: true,
  declineReasonCode: "partner_reason_affordability",
  attributionKey: "campaign-42",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
};

function canonical(
  bodyText: string,
  timestamp = TIMESTAMP,
  nonce = "nonce-1234567890",
  idempotencyKey = "idem-1234567890",
  credentialKey = "sandbox-credential",
) {
  return [
    "POST",
    "/api/partner/declines",
    credentialKey,
    timestamp,
    nonce,
    idempotencyKey,
    bodyText,
  ].join("\n");
}

function signedRequest(
  payload: unknown = validPayload,
  overrides: Partial<Record<"timestamp" | "nonce" | "idempotencyKey" | "credentialKey" | "signature", string>> = {},
) {
  const bodyText = JSON.stringify(payload);
  const timestamp = overrides.timestamp ?? TIMESTAMP;
  const nonce = overrides.nonce ?? "nonce-1234567890";
  const idempotencyKey = overrides.idempotencyKey ?? "idem-1234567890";
  const credentialKey = overrides.credentialKey ?? "sandbox-credential";
  const signature = overrides.signature ?? createHmac("sha256", SECRET)
    .update(canonical(bodyText, timestamp, nonce, idempotencyKey, credentialKey))
    .digest("hex");

  return new Request("https://credit-quest-app.vercel.app/api/partner/declines", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cq-partner-credential": credentialKey,
      "x-cq-timestamp": timestamp,
      "x-cq-nonce": nonce,
      "x-cq-idempotency-key": idempotencyKey,
      "x-cq-signature": signature,
    },
    body: bodyText,
  });
}

const credential = {
  credentialId: "11111111-1111-4111-8111-111111111111",
  credentialKey: "sandbox-credential",
  secretReference: "CQ_TEST_PARTNER_SECRET",
  credentialEnabled: true,
  validFrom: "2026-01-01T00:00:00.000Z",
  expiresAt: null,
  partnerId: "22222222-2222-4222-8222-222222222222",
  partnerKey: "example-lender",
  partnerDisplayName: "Example Lender",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
};

describe("sandbox partner decline intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CQ_TEST_PARTNER_SECRET = SECRET;
    vi.setSystemTime(NOW);

    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerCredentialByKey.mockResolvedValue(credential);
    mocks.findPartnerIntakeByNonce.mockResolvedValue(null);
    mocks.findPartnerIntakeByIdempotency.mockResolvedValue(null);
    mocks.findEligibleSandboxReturnContract.mockResolvedValue(null);
    mocks.insertPartnerIntakeSession.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("accepts only minimal structured decline context and rejects trusted or sensitive overreach", () => {
    expect(partnerDeclineSchema.safeParse(validPayload).success).toBe(true);

    for (const forbidden of [
      { partnerId: credential.partnerId },
      { environment: "live" },
      { returnUrl: "https://evil.example/return" },
      { email: "customer@example.com" },
      { fullName: "Customer Name" },
      { dateOfBirth: "1980-01-01" },
      { address: "1 Example Street" },
      { healthDetails: "medical diagnosis" },
      { underwritingNotes: "internal lender notes" },
    ]) {
      expect(partnerDeclineSchema.safeParse({ ...validPayload, ...forbidden }).success).toBe(false);
    }
  });

  it("requires an actual reason when the partner says one was supplied", () => {
    expect(partnerDeclineSchema.safeParse({
      ...validPayload,
      declineReasonProvided: true,
      declineReasonCode: null,
    }).success).toBe(false);
  });

  it("fails closed while the intake feature flag is off", async () => {
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(false);

    const response = await POST(signedRequest());

    expect(response.status).toBe(409);
    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("accepts a valid sandbox signed request and persists only the token hash", async () => {
    const response = await POST(signedRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.handoffUrl).toMatch(/^\/recovery\/handoff\/[A-Za-z0-9_-]{40,}$/);
    expect(body.token).toBeUndefined();

    const inserted = mocks.insertPartnerIntakeSession.mock.calls[0][1];
    expect(inserted).toMatchObject({
      partnerId: credential.partnerId,
      credentialId: credential.credentialId,
      returnContractId: null,
      environment: "sandbox",
      originReference: validPayload.originReference,
      productCategory: "credit_card",
      declineReasonSource: "partner",
      idempotencyKey: "idem-1234567890",
      nonce: "nonce-1234567890",
      requestTimestamp: TIMESTAMP,
    });
    expect(inserted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(inserted)).not.toContain(body.handoffUrl.split("/").pop());
  });

  it("rejects an invalid signature", async () => {
    const response = await POST(signedRequest(validPayload, { signature: "0".repeat(64) }));

    expect(response.status).toBe(401);
    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("rejects an expired request timestamp", async () => {
    const response = await POST(signedRequest(validPayload, {
      timestamp: "2026-09-03T06:20:00.000Z",
    }));

    expect(response.status).toBe(401);
    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("rejects nonce replay and duplicate idempotency without issuing a second token", async () => {
    mocks.findPartnerIntakeByNonce.mockResolvedValueOnce({ id: "existing" });
    const replay = await POST(signedRequest());
    expect(replay.status).toBe(409);

    mocks.findPartnerIntakeByNonce.mockResolvedValueOnce(null);
    mocks.findPartnerIntakeByIdempotency.mockResolvedValueOnce({ id: "existing" });
    const duplicate = await POST(signedRequest(validPayload, { nonce: "nonce-different-123" }));
    expect(duplicate.status).toBe(409);

    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("rejects disabled, expired, or non-sandbox partner credentials", async () => {
    for (const disabledCredential of [
      { ...credential, credentialEnabled: false },
      { ...credential, expiresAt: "2026-09-03T06:29:59.000Z" },
      { ...credential, partnerEnabled: false },
      { ...credential, partnerSandboxEnabled: false, partnerLiveEnabled: true },
    ]) {
      mocks.getPartnerCredentialByKey.mockResolvedValueOnce(disabledCredential);
      const response = await POST(signedRequest(validPayload, {
        nonce: `nonce-${Math.random()}`,
        idempotencyKey: `idem-${Math.random()}`,
      }));
      expect(response.status).toBe(401);
    }

    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });

  it("never accepts a client-supplied live environment", async () => {
    const response = await POST(signedRequest({ ...validPayload, environment: "live" }));

    expect(response.status).toBe(400);
    expect(mocks.insertPartnerIntakeSession).not.toHaveBeenCalled();
  });
});

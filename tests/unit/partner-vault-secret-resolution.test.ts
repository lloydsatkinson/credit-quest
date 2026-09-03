import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  getPartnerIntakeFeatureEnabled: vi.fn(),
  getPartnerCredentialByKey: vi.fn(),
  getVaultPartnerSecret: vi.fn(),
  findPartnerIntakeByNonce: vi.fn(),
  findPartnerIntakeByIdempotency: vi.fn(),
  findEligibleSandboxReturnContract: vi.fn(),
  insertPartnerIntakeSession: vi.fn(),
  getPartnerHandoffByTokenHash: vi.fn(),
  redeemPartnerHandoffAtomically: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));

vi.mock("@/lib/server/partner-intake-repository", () => ({
  getPartnerIntakeFeatureEnabled: mocks.getPartnerIntakeFeatureEnabled,
  getPartnerCredentialByKey: mocks.getPartnerCredentialByKey,
  getVaultPartnerSecret: mocks.getVaultPartnerSecret,
  findPartnerIntakeByNonce: mocks.findPartnerIntakeByNonce,
  findPartnerIntakeByIdempotency: mocks.findPartnerIntakeByIdempotency,
  findEligibleSandboxReturnContract: mocks.findEligibleSandboxReturnContract,
  insertPartnerIntakeSession: mocks.insertPartnerIntakeSession,
  getPartnerHandoffByTokenHash: mocks.getPartnerHandoffByTokenHash,
  redeemPartnerHandoffAtomically: mocks.redeemPartnerHandoffAtomically,
}));

import { processPartnerDeclineIntake } from "@/lib/server/partner-intake-service";

const NOW = new Date("2026-09-03T13:10:00.000Z");
const SECRET = "vault-backed-pilot-secret-that-is-long-enough";
const PARTNER_ID = "22222222-2222-4222-8222-222222222222";

const payload = {
  originReference: "internal-pilot-vault-001",
  productCategory: "credit_card",
  declinedAt: "2026-09-03T13:00:00.000Z",
  declineReasonProvided: true,
  declineReasonCode: "partner_reason_affordability",
  attributionKey: "internal-pilot",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
};

function signedHeaders(bodyText: string) {
  const credentialKey = "internal-pilot-credential";
  const timestamp = NOW.toISOString();
  const nonce = "vault-nonce-1234567890";
  const idempotencyKey = "vault-idem-1234567890";
  const canonical = [
    "POST",
    "/api/partner/declines",
    credentialKey,
    timestamp,
    nonce,
    idempotencyKey,
    bodyText,
  ].join("\n");
  const signature = createHmac("sha256", SECRET).update(canonical).digest("hex");

  return new Headers({
    "content-type": "application/json",
    "x-cq-partner-credential": credentialKey,
    "x-cq-timestamp": timestamp,
    "x-cq-nonce": nonce,
    "x-cq-idempotency-key": idempotencyKey,
    "x-cq-signature": signature,
  });
}

describe("Vault-backed partner signing secret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerCredentialByKey.mockResolvedValue({
      credentialId: "11111111-1111-4111-8111-111111111111",
      credentialKey: "internal-pilot-credential",
      secretReference: "vault:cq-internal-pilot-credential",
      credentialEnabled: true,
      validFrom: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      partnerId: PARTNER_ID,
      partnerKey: "internal-pilot",
      partnerDisplayName: "Credit Quest Internal Pilot",
      partnerEnabled: true,
      partnerSandboxEnabled: true,
      partnerLiveEnabled: false,
    });
    mocks.getVaultPartnerSecret.mockResolvedValue(SECRET);
    mocks.findPartnerIntakeByNonce.mockResolvedValue(null);
    mocks.findPartnerIntakeByIdempotency.mockResolvedValue(null);
    mocks.findEligibleSandboxReturnContract.mockResolvedValue(null);
    mocks.insertPartnerIntakeSession.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
  });

  it("resolves a vault: reference through the admin repository and verifies the same HMAC contract", async () => {
    const bodyText = JSON.stringify(payload);

    await expect(processPartnerDeclineIntake({
      bodyText,
      headers: signedHeaders(bodyText),
      now: NOW,
    })).resolves.toEqual(expect.objectContaining({
      handoffUrl: expect.stringMatching(/^\/recovery\/handoff\//),
    }));

    expect(mocks.getVaultPartnerSecret).toHaveBeenCalledWith(
      { kind: "admin" },
      "cq-internal-pilot-credential",
    );
    expect(mocks.insertPartnerIntakeSession).toHaveBeenCalledTimes(1);
  });
});

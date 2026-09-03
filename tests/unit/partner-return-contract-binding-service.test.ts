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
  getPartnerHandoffByTokenHash: vi.fn(),
  redeemPartnerHandoffAtomically: vi.fn(),
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
  getPartnerHandoffByTokenHash: mocks.getPartnerHandoffByTokenHash,
  redeemPartnerHandoffAtomically: mocks.redeemPartnerHandoffAtomically,
}));

import { processPartnerDeclineIntake } from "@/lib/server/partner-intake-service";

const NOW = new Date("2026-09-03T09:00:00.000Z");
const SECRET = "internal-pilot-secret-that-is-long-enough";
const PARTNER_ID = "22222222-2222-4222-8222-222222222222";
const CONTRACT_ID = "44444444-4444-4444-8444-444444444444";

const payload = {
  originReference: "internal-pilot-application-001",
  productCategory: "credit_card",
  declinedAt: "2026-09-03T08:45:00.000Z",
  declineReasonProvided: true,
  declineReasonCode: "partner_reason_affordability",
  attributionKey: "internal-pilot",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
};

function signedHeaders(bodyText: string) {
  const timestamp = NOW.toISOString();
  const nonce = "pilot-nonce-1234567890";
  const idempotencyKey = "pilot-idem-1234567890";
  const credentialKey = "internal-pilot-credential";
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

describe("partner intake return-contract binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    process.env.CQ_INTERNAL_PILOT_PARTNER_SECRET = SECRET;

    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerCredentialByKey.mockResolvedValue({
      credentialId: "11111111-1111-4111-8111-111111111111",
      credentialKey: "internal-pilot-credential",
      secretReference: "CQ_INTERNAL_PILOT_PARTNER_SECRET",
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
    mocks.findPartnerIntakeByNonce.mockResolvedValue(null);
    mocks.findPartnerIntakeByIdempotency.mockResolvedValue(null);
    mocks.findEligibleSandboxReturnContract.mockResolvedValue({ id: CONTRACT_ID });
    mocks.insertPartnerIntakeSession.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
  });

  it("binds the one eligible sandbox contract resolved from authenticated partner plus product", async () => {
    const bodyText = JSON.stringify(payload);

    await processPartnerDeclineIntake({
      bodyText,
      headers: signedHeaders(bodyText),
      now: NOW,
    });

    expect(mocks.findEligibleSandboxReturnContract).toHaveBeenCalledWith(
      { kind: "admin" },
      PARTNER_ID,
      "credit_card",
      NOW,
    );
    expect(mocks.insertPartnerIntakeSession).toHaveBeenCalledWith(
      { kind: "admin" },
      expect.objectContaining({
        partnerId: PARTNER_ID,
        productCategory: "credit_card",
        environment: "sandbox",
        returnContractId: CONTRACT_ID,
      }),
    );
  });
});

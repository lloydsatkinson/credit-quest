import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  getPartnerIntakeFeatureEnabled: vi.fn(),
  getPartnerCredentialByKey: vi.fn(),
  findPartnerIntakeByNonce: vi.fn(),
  findPartnerIntakeByIdempotency: vi.fn(),
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
  insertPartnerIntakeSession: mocks.insertPartnerIntakeSession,
  getPartnerHandoffByTokenHash: vi.fn(),
  redeemPartnerHandoffAtomically: vi.fn(),
}));

import { processPartnerDeclineIntake } from "@/lib/server/partner-intake-service";

const SECRET = "vault-backed-partner-secret-that-is-long-enough";
const NOW = new Date("2026-09-03T12:30:00.000Z");
const bodyText = JSON.stringify({
  originReference: "pilot-vault-1",
  productCategory: "credit_card",
  declinedAt: "2026-09-03T12:25:00.000Z",
  declineReasonProvided: false,
  declineReasonCode: null,
  attributionKey: "internal-pilot",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
});

function headers() {
  const timestamp = NOW.toISOString();
  const nonce = "vaultnonce12345678";
  const idempotencyKey = "vault-idem-123456";
  const credentialKey = "sandbox-vault-credential";
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
    "x-cq-partner-credential": credentialKey,
    "x-cq-timestamp": timestamp,
    "x-cq-nonce": nonce,
    "x-cq-idempotency-key": idempotencyKey,
    "x-cq-signature": signature,
  });
}

describe("partner intake Vault secret wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
    const admin = {
      rpc: vi.fn().mockResolvedValue({ data: SECRET, error: null }),
    };
    mocks.createAdminSupabaseClient.mockReturnValue(admin);
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerCredentialByKey.mockResolvedValue({
      credentialId: "11111111-1111-4111-8111-111111111111",
      credentialKey: "sandbox-vault-credential",
      secretReference: "vault:cq-internal-pilot-partner",
      credentialEnabled: true,
      validFrom: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
      partnerId: "22222222-2222-4222-8222-222222222222",
      partnerKey: "internal-pilot",
      partnerDisplayName: "Internal Pilot",
      partnerEnabled: true,
      partnerSandboxEnabled: true,
      partnerLiveEnabled: false,
    });
    mocks.findPartnerIntakeByNonce.mockResolvedValue(null);
    mocks.findPartnerIntakeByIdempotency.mockResolvedValue(null);
    mocks.insertPartnerIntakeSession.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
  });

  it("authenticates a sandbox intake using the Vault-backed secret", async () => {
    const result = await processPartnerDeclineIntake({ bodyText, headers: headers(), now: NOW });
    const admin = mocks.createAdminSupabaseClient.mock.results[0].value;

    expect(result.handoffUrl).toMatch(/^\/recovery\/handoff\//);
    expect(admin.rpc).toHaveBeenCalledWith("get_partner_secret_from_vault", {
      p_secret_name: "cq-internal-pilot-partner",
    });
    expect(mocks.insertPartnerIntakeSession).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  getPartnerIntakeFeatureEnabled: vi.fn(),
  getPartnerCredentialByKey: vi.fn(),
  findPartnerIntakeByNonce: vi.fn(),
  findPartnerIntakeByIdempotency: vi.fn(),
  insertPartnerIntakeSession: vi.fn(),
  getPartnerHandoffByTokenHash: vi.fn(),
  consumePartnerIntakeSession: vi.fn(),
  redeemPartnerHandoffAtomically: vi.fn(),
  createPartnerRecoveryJourney: vi.fn(),
  buildRecoveryPolicySnapshotForActivation: vi.fn(),
  resolveRecoveryPolicyForActivation: vi.fn(),
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
  getPartnerHandoffByTokenHash: mocks.getPartnerHandoffByTokenHash,
  consumePartnerIntakeSession: mocks.consumePartnerIntakeSession,
  redeemPartnerHandoffAtomically: mocks.redeemPartnerHandoffAtomically,
}));

vi.mock("@/lib/server/recovery-repository", () => ({
  createPartnerRecoveryJourney: mocks.createPartnerRecoveryJourney,
}));

vi.mock("@/lib/server/recovery-policy-service", () => ({
  buildRecoveryPolicySnapshotForActivation: mocks.buildRecoveryPolicySnapshotForActivation,
  resolveRecoveryPolicyForActivation: mocks.resolveRecoveryPolicyForActivation,
}));

import { redeemPartnerHandoff } from "@/lib/server/partner-intake-service";

const NOW = new Date("2026-09-03T10:30:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "A".repeat(43);
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

const session = {
  id: SESSION_ID,
  partnerId: "33333333-3333-4333-8333-333333333333",
  environment: "sandbox" as const,
  originReference: "application-abc-123",
  productCategory: "credit_card" as const,
  declinedAt: "2026-09-02T15:30:00.000Z",
  declineReasonCode: "partner_reason_affordability",
  declineReasonSource: "partner" as const,
  attributionKey: "campaign-42",
  additionalSupportMayBeNeeded: null,
  disclosureVersion: "decline-v1",
  consentVersion: "handoff-v1",
  tokenExpiresAt: "2026-09-03T10:40:00.000Z",
  consumedAt: null,
  boundUserId: null,
  partnerDisplayName: "Example Lender",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
};

const policySnapshot = {
  schemaVersion: 1 as const,
  partnerId: session.partnerId,
  productCategory: "credit_card" as const,
  capturedAt: NOW.toISOString(),
  contextConfirmation: "confirmed" as const,
  customerCorrectionCode: null,
  usePartnerReasonsForTreatment: true,
  partnerReasons: [],
  unmappedExternalCodes: [],
};

describe("atomic partner handoff redemption", () => {
  it("builds the frozen policy snapshot before redemption and binds consume + journey + snapshot through one atomic RPC", async () => {
    vi.clearAllMocks();
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerHandoffByTokenHash.mockResolvedValue(session);
    mocks.buildRecoveryPolicySnapshotForActivation.mockResolvedValue(policySnapshot);
    mocks.redeemPartnerHandoffAtomically.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      origin: "partner",
      productCategory: "credit_card",
      declineReasonKnown: true,
      declineReasonCode: "partner_reason_affordability",
      declineReasonSource: "partner",
      contextConfirmation: "confirmed",
    });

    const result = await redeemPartnerHandoff({
      token: TOKEN,
      userId: USER_ID,
      review: { contextAction: "confirm", correctedReasonCode: null },
      now: NOW,
    });

    expect(mocks.buildRecoveryPolicySnapshotForActivation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        intakeSessionId: SESSION_ID,
        partnerId: session.partnerId,
        productCategory: "credit_card",
        contextConfirmation: "confirmed",
        customerCorrectionCode: null,
        now: NOW,
      }),
    );
    expect(mocks.redeemPartnerHandoffAtomically).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: SESSION_ID,
        userId: USER_ID,
        declineReasonKnown: true,
        declineReasonCode: "partner_reason_affordability",
        declineReasonSource: "partner",
        contextConfirmation: "confirmed",
        policySnapshot,
        now: NOW,
      }),
    );
    expect(mocks.resolveRecoveryPolicyForActivation).not.toHaveBeenCalled();
    expect(mocks.createPartnerRecoveryJourney).not.toHaveBeenCalled();
    expect(mocks.consumePartnerIntakeSession).not.toHaveBeenCalled();
    expect(result.id).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("does not consume the handoff if policy resolution fails before the atomic RPC", async () => {
    vi.clearAllMocks();
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getPartnerIntakeFeatureEnabled.mockResolvedValue(true);
    mocks.getPartnerHandoffByTokenHash.mockResolvedValue(session);
    mocks.buildRecoveryPolicySnapshotForActivation.mockRejectedValue(new Error("policy_snapshot_unavailable"));

    await expect(redeemPartnerHandoff({
      token: TOKEN,
      userId: USER_ID,
      review: { contextAction: "confirm", correctedReasonCode: null },
      now: NOW,
    })).rejects.toThrow(/policy_snapshot_unavailable/i);

    expect(mocks.redeemPartnerHandoffAtomically).not.toHaveBeenCalled();
    expect(mocks.resolveRecoveryPolicyForActivation).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import type { ApplicationReadiness, CreditProfile } from "@/lib/domain/types";
import { createReturnOriginGateway } from "@/lib/server/return-origin-gateway";

const profile: CreditProfile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 22,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 1,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const readiness: ApplicationReadiness = {
  state: "green",
  headline: "Ready to check",
  reasons: [],
  avoid: [],
  actions: [],
  reassessAt: null,
  daysUntilReassessment: null,
};

const journey = {
  id: "recovery-1",
  userId: "user-1",
  origin: "partner" as const,
  productCategory: "credit_card" as const,
  partnerId: "partner-1",
  returnContractId: "contract-1",
  originReference: "origin-ref-1",
  nextReassessmentAt: null,
  declinedAt: "2026-08-01T09:00:00.000Z",
};

const contract = {
  id: "contract-1",
  contractKey: "return-card-1",
  partnerId: "partner-1",
  partnerDisplayName: "Example Bank",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
  environment: "sandbox" as const,
  destinationUrl: "/sandbox/referral-complete",
  productCategory: "credit_card" as const,
  disclosureKey: "return-to-origin",
  disclosureVersion: 2,
  callbackPolicy: "ready_for_recheck" as const,
  callbackUrl: null,
  enabled: true,
  expiresAt: "2026-10-01T00:00:00.000Z",
};

const disclosure = {
  id: "disclosure-2",
  disclosureKey: "return-to-origin",
  version: 2,
  body: "You can check eligibility again. Approval is not guaranteed.",
};

function deps(originalPolicySatisfied: boolean) {
  const isOriginalPolicySatisfied = vi.fn().mockResolvedValue(originalPolicySatisfied);
  return {
    isOriginalPolicySatisfied,
    gateway: createReturnOriginGateway({
      getGuidance: vi.fn().mockResolvedValue({ profile, readiness }),
      getRecoveryJourney: vi.fn().mockResolvedValue(journey),
      getReturnContract: vi.fn().mockResolvedValue(contract),
      getDisclosure: vi.fn().mockResolvedValue(disclosure),
      isGatewayEnabled: vi.fn().mockResolvedValue(true),
      isSandboxPilot: vi.fn().mockResolvedValue(true),
      isSuppressionClear: vi.fn().mockResolvedValue(true),
      appendReturnAttempt: vi.fn().mockResolvedValue({ id: "attempt-1" }),
      liveAllowed: false,
      isOriginalPolicySatisfied,
    }),
  };
}

describe("V2.3 original-lender reassessment gate", () => {
  it("blocks the original return while the pinned lender reassessment rule is not satisfied", async () => {
    const { gateway, isOriginalPolicySatisfied } = deps(false);
    const now = new Date("2026-09-03T09:00:00.000Z");

    await expect(gateway.createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "continue",
      now,
    })).rejects.toMatchObject({ code: "lender_reassessment_not_satisfied" });

    expect(isOriginalPolicySatisfied).toHaveBeenCalledWith(expect.objectContaining({
      recoveryJourneyId: "recovery-1",
      partnerId: "partner-1",
      productCategory: "credit_card",
      declinedAt: "2026-08-01T09:00:00.000Z",
      now,
      facts: expect.objectContaining({
        hardApplicationsLast6m: 1,
        readinessReady: true,
        evidenceComplete: true,
      }),
    }));
  });

  it("permits the existing original return flow once the pinned lender reassessment rule is satisfied", async () => {
    const { gateway } = deps(true);

    await expect(gateway.createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "continue",
      now: new Date("2026-09-03T09:00:00.000Z"),
    })).resolves.toMatchObject({
      status: "redirect",
      destinationUrl: "/sandbox/referral-complete",
    });
  });
});
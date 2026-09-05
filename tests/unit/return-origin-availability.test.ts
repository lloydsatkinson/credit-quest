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
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

function readiness(state: ApplicationReadiness["state"] = "green"): ApplicationReadiness {
  return {
    state,
    headline: state,
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

const journey = {
  id: "recovery-1",
  userId: "user-1",
  origin: "partner" as const,
  productCategory: "credit_card" as const,
  partnerId: "partner-1",
  returnContractId: "contract-1",
  originReference: "origin-ref-1",
  nextReassessmentAt: null,
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
  callbackUrl: "https://partner.example/callback",
  enabled: true,
  expiresAt: "2026-10-01T00:00:00.000Z",
};

const disclosure = {
  id: "disclosure-2",
  disclosureKey: "return-to-origin",
  version: 2,
  body: "You are ready to check eligibility again. Approval is not guaranteed.",
};

function deps(overrides: Record<string, unknown> = {}) {
  return {
    getGuidance: vi.fn().mockResolvedValue({ profile, readiness: readiness("green") }),
    getRecoveryJourney: vi.fn().mockResolvedValue(journey),
    getReturnContract: vi.fn().mockResolvedValue(contract),
    getDisclosure: vi.fn().mockResolvedValue(disclosure),
    isGatewayEnabled: vi.fn().mockResolvedValue(true),
    isSandboxPilot: vi.fn().mockResolvedValue(true),
    isSuppressionClear: vi.fn().mockResolvedValue(true),
    appendReturnAttempt: vi.fn().mockResolvedValue({ id: "attempt-1" }),
    liveAllowed: false,
    ...overrides,
  };
}

const at = new Date("2026-09-03T09:00:00.000Z");

describe("read-only Return-to-Origin availability", () => {
  it("reports an available partner return without creating an attempt or exposing a destination", async () => {
    const d = deps();
    const result = await createReturnOriginGateway(d).getAvailability({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      now: at,
    });

    expect(result).toEqual({
      status: "available",
      reason: null,
      partnerDisplayName: "Example Bank",
    });
    expect(result).not.toHaveProperty("destinationUrl");
    expect(d.appendReturnAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ["gateway disabled", { isGatewayEnabled: vi.fn().mockResolvedValue(false) }, "gateway_disabled"],
    ["future cooldown", { getRecoveryJourney: vi.fn().mockResolvedValue({ ...journey, nextReassessmentAt: "2026-09-10T09:00:00.000Z" }) }, "cooldown_active"],
    ["missing evidence", { getGuidance: vi.fn().mockResolvedValue({ profile: { ...profile, hardApplicationsLast6m: null }, readiness: readiness("green") }) }, "missing_evidence"],
    ["stale disclosure", { getDisclosure: vi.fn().mockResolvedValue({ ...disclosure, version: 3 }) }, "disclosure_stale"],
    ["live hard lock", { getReturnContract: vi.fn().mockResolvedValue({ ...contract, environment: "live", partnerLiveEnabled: true }) }, "live_not_allowed"],
  ])("reports %s as blocked without writing an attempt", async (_label, override, reason) => {
    const d = deps(override as Record<string, unknown>);
    const result = await createReturnOriginGateway(d).getAvailability({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      now: at,
    });

    expect(result).toMatchObject({ status: "blocked", reason });
    expect(result).not.toHaveProperty("destinationUrl");
    expect(d.appendReturnAttempt).not.toHaveBeenCalled();
  });

  it("reports missing partner recovery context as unavailable", async () => {
    const d = deps({ getRecoveryJourney: vi.fn().mockResolvedValue(null) });
    const result = await createReturnOriginGateway(d).getAvailability({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      now: at,
    });

    expect(result).toEqual({
      status: "unavailable",
      reason: "recovery_unavailable",
      partnerDisplayName: null,
    });
    expect(d.appendReturnAttempt).not.toHaveBeenCalled();
  });

  it("reports a missing return contract as unavailable", async () => {
    const d = deps({ getReturnContract: vi.fn().mockResolvedValue(null) });
    const result = await createReturnOriginGateway(d).getAvailability({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      now: at,
    });

    expect(result).toEqual({
      status: "unavailable",
      reason: "contract_unavailable",
      partnerDisplayName: null,
    });
    expect(d.appendReturnAttempt).not.toHaveBeenCalled();
  });
});

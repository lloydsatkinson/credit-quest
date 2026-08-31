import { describe, expect, it } from "vitest";
import {
  evaluateCommercialPresentationGate,
  evaluateCommercialReferralGate,
  hasRequiredCommercialEvidence,
} from "@/lib/commercial/gates";
import type { CreditProfile } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 10,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const allowed = {
  gatewayEnabled: true,
  liveAllowed: false,
  environment: "sandbox" as const,
  ageMode: "adult" as const,
  safetyMode: "normal" as const,
  readinessState: "green" as const,
  evidenceComplete: true,
  partnerEnabled: true,
  partnerEnvironmentEnabled: true,
  routeEnabled: true,
  routeEnvironment: "sandbox" as const,
  disclosurePresent: true,
};

describe("commercial hard gates", () => {
  it("blocks every non-green readiness state", () => {
    for (const state of ["red", "amber", "unknown"] as const) {
      expect(evaluateCommercialPresentationGate({ ...allowed, readinessState: state }))
        .toEqual({ permitted: false, reason: "readiness_not_green" });
    }
  });

  it("blocks unknown revolving-credit evidence independently of readiness", () => {
    expect(hasRequiredCommercialEvidence({ ...profile, hasRevolvingCredit: null })).toBe(false);
    expect(hasRequiredCommercialEvidence({ ...profile, utilisationPct: null })).toBe(false);
  });

  it("shows disclosure before consent but requires consent to create a referral", () => {
    expect(evaluateCommercialPresentationGate(allowed)).toEqual({ permitted: true });
    expect(evaluateCommercialReferralGate({ ...allowed, consent: false }))
      .toEqual({ permitted: false, reason: "consent_missing" });
    expect(evaluateCommercialReferralGate({ ...allowed, consent: true }))
      .toEqual({ permitted: true });
  });

  it("enforces protective and configuration failures in stable order", () => {
    expect(evaluateCommercialPresentationGate({ ...allowed, gatewayEnabled: false, ageMode: "education" }))
      .toEqual({ permitted: false, reason: "gateway_disabled" });
    expect(evaluateCommercialPresentationGate({ ...allowed, environment: "live", routeEnvironment: "live" }))
      .toEqual({ permitted: false, reason: "live_not_allowed" });
    expect(evaluateCommercialPresentationGate({ ...allowed, ageMode: "education" }))
      .toEqual({ permitted: false, reason: "under_18" });
    expect(evaluateCommercialPresentationGate({ ...allowed, safetyMode: "safe_mode" }))
      .toEqual({ permitted: false, reason: "safe_mode" });
    expect(evaluateCommercialPresentationGate({ ...allowed, evidenceComplete: false }))
      .toEqual({ permitted: false, reason: "missing_evidence" });
    expect(evaluateCommercialPresentationGate({ ...allowed, partnerEnabled: false }))
      .toEqual({ permitted: false, reason: "partner_disabled" });
    expect(evaluateCommercialPresentationGate({ ...allowed, partnerEnvironmentEnabled: false }))
      .toEqual({ permitted: false, reason: "partner_disabled" });
    expect(evaluateCommercialPresentationGate({ ...allowed, routeEnabled: false }))
      .toEqual({ permitted: false, reason: "route_disabled" });
    expect(evaluateCommercialPresentationGate({ ...allowed, routeEnvironment: "live" }))
      .toEqual({ permitted: false, reason: "environment_not_permitted" });
    expect(evaluateCommercialPresentationGate({ ...allowed, disclosurePresent: false }))
      .toEqual({ permitted: false, reason: "disclosure_missing" });
  });
});

import { describe, expect, it } from "vitest";
import type { ApplicationReadiness, BarrierDiagnosis, CreditPassport } from "@/lib/domain/types";
import { resolveRecoveryBarriers } from "@/lib/recovery/multi-barrier-resolver";
import {
  buildRecoveryPlan,
  buildRecoveryPolicyContext,
} from "@/lib/recovery/plan";
import type { RecoveryPolicySnapshot } from "@/lib/recovery/policy-snapshot";

const diagnosis: BarrierDiagnosis = {
  primary: "optimiser",
  secondary: [],
  confidence: "medium",
  factors: [],
};

const passport: CreditPassport = {
  pillars: [{
    id: "identity",
    title: "Identity",
    status: "green",
    strength: "Identity evidence is present.",
    helping: [],
    hurting: [],
    unknowns: [],
    nextActions: [],
  }],
};

function readiness(state: ApplicationReadiness["state"]): ApplicationReadiness {
  return {
    state,
    headline: state === "green" ? "Ready from Credit Quest evidence" : "Not ready from Credit Quest evidence",
    reasons: [],
    avoid: [],
    actions: [],
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

function snapshot(
  canonicalCode: string | null,
  treatment: RecoveryPolicySnapshot["partnerReasons"][number]["treatment"],
  solveability: RecoveryPolicySnapshot["partnerReasons"][number]["solveability"],
  alternativeRoutePolicyIds: string[] = [],
  restricted = false,
): RecoveryPolicySnapshot {
  return {
    schemaVersion: 1,
    partnerId: "partner-1",
    productCategory: "credit_card",
    capturedAt: "2026-09-09T09:00:00.000Z",
    contextConfirmation: "confirmed",
    customerCorrectionCode: null,
    usePartnerReasonsForTreatment: true,
    partnerReasons: [{
      externalCode: canonicalCode ?? "UNMAPPED_PARTNER_CODE",
      mappingId: canonicalCode ? "mapping-1" : null,
      mappingVersion: canonicalCode ? 1 : null,
      canonicalCode,
      treatment,
      solveability,
      restricted,
      parameters: {},
      templateId: null,
      templateVersion: null,
      reassessmentRuleId: null,
      reassessmentRuleVersion: null,
      alternativeRoutePolicyIds,
    }],
    unmappedExternalCodes: canonicalCode ? [] : ["UNMAPPED_PARTNER_CODE"],
  };
}

function planFor(
  policySnapshot: RecoveryPolicySnapshot,
  state: ApplicationReadiness["state"] = "amber",
  nextMission = { slug: "electoral-roll", title: "Confirm your electoral-roll details", nextReviewAt: null },
) {
  const reasonCodes = policySnapshot.partnerReasons.map((reason) => reason.canonicalCode ?? reason.externalCode);
  const resolution = resolveRecoveryBarriers({ reasonCodes });
  const policyContext = buildRecoveryPolicyContext(policySnapshot, resolution);
  return buildRecoveryPlan({
    safetyMode: "normal",
    readiness: readiness(state),
    diagnosis,
    passport,
    nextMission,
    policyContext,
  });
}

describe("V2.3 configured treatment in the existing Recovery Experience", () => {
  it("shows FIX context for CAIS duplicate without replacing the core next mission", () => {
    const plan = planFor(snapshot("CAIS_DUPLICATE", "fix", "fix_now"));

    expect(plan.policyContext).toMatchObject({
      treatment: "fix",
      primaryReasonCode: "CAIS_DUPLICATE",
    });
    expect(plan.policyContext?.customerHeadline.toLowerCase()).toMatch(/check|correct/);
    expect(plan.nextSafeAction).toMatchObject({
      kind: "mission",
      missionSlug: "electoral-roll",
      title: "Confirm your electoral-roll details",
    });
  });

  it("shows BUILD context for thin file but green readiness still comes only from Application Readiness", () => {
    const amber = planFor(snapshot("THIN_FILE", "build", "build_evidence"), "amber", null);
    expect(amber.policyContext?.treatment).toBe("build");
    expect(amber.stage).not.toBe("ready_to_check");
    expect(amber.readinessState).not.toBe("ready_to_check");

    const green = planFor(snapshot("THIN_FILE", "build", "build_evidence"), "green", null);
    expect(green.stage).toBe("ready_to_check");
    expect(green.readinessState).toBe("ready_to_check");
  });

  it("never exposes alternative-credit potential for negative disposable income even when a route policy exists", () => {
    const plan = planFor(snapshot(
      "NEGATIVE_DISPOSABLE_INCOME",
      "create_headroom",
      "stabilise_first",
      ["alternative-policy-1"],
    ));

    expect(plan.policyContext).toMatchObject({
      treatment: "create_headroom",
      alternativeRoutePotential: false,
      originalProductBlocked: true,
    });
  });

  it("uses longer-term recovery context for active IVA without fabricating a reassessment date", () => {
    const plan = planFor(snapshot("ACTIVE_IVA", "longer_term_recovery", "structural_long_horizon"), "amber", null);

    expect(plan.policyContext?.treatment).toBe("longer_term_recovery");
    expect(plan.policyContext?.customerHeadline.toLowerCase()).toContain("longer");
    expect(plan.nextReassessmentAt).toBeNull();
  });

  it("keeps unmapped decline context neutral rather than guessing a cause", () => {
    const policySnapshot = snapshot(null, "needs_evidence", "unknown_or_unmapped");
    const plan = planFor(policySnapshot, "amber", null);

    expect(plan.policyContext).toMatchObject({
      primaryReasonCode: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
      alternativeRoutePotential: false,
    });
    expect(plan.policyContext?.customerHeadline.toLowerCase()).toMatch(/more information|need more/);
    expect(JSON.stringify(plan.policyContext).toLowerCase()).not.toContain("affordability");
  });

  it("keeps restricted fraud/security decisions outside a normal recovery mission chain", () => {
    const plan = planFor(snapshot(
      "FRAUD_SECURITY_DECISION",
      "restricted",
      "restricted",
      ["alternative-policy-should-never-run"],
      true,
    ));

    expect(plan.policyContext).toMatchObject({
      treatment: "restricted",
      alternativeRoutePotential: false,
    });
    expect(plan.nextSafeAction.kind).not.toBe("mission");
    expect(plan.nextSafeAction.title.toLowerCase()).toMatch(/outside|cannot|can’t|security/);
  });
});

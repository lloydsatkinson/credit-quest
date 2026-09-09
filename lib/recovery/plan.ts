import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
} from "@/lib/domain/types";
import type { SafetyMode } from "@/lib/domain/safety";
import type { BarrierResolution } from "@/lib/recovery/multi-barrier-resolver";
import type { RecoveryPolicySnapshot } from "@/lib/recovery/policy-snapshot";
import { toRecoveryReadinessState } from "@/lib/recovery/readiness";
import type {
  RecoveryPolicyContext,
  RecoveryReadinessState,
} from "@/lib/recovery/types";

export type RecoveryStage =
  | "intake"
  | "crisis_recovery"
  | "stability"
  | "rebuilding"
  | "optimisation"
  | "ready_to_check";

export interface RecoveryMissionSummary {
  slug: string;
  title: string;
  nextReviewAt: string | null;
}

export type RecoveryNextSafeAction =
  | { kind: "stabilise"; title: string; missionSlug: null }
  | { kind: "mission"; title: string; missionSlug: string }
  | { kind: "evidence"; title: string; missionSlug: null }
  | { kind: "ready_to_check"; title: string; missionSlug: null };

export interface RecoveryPlanProjection {
  stage: RecoveryStage;
  readinessState: RecoveryReadinessState;
  nextSafeAction: RecoveryNextSafeAction;
  evidenceGaps: string[];
  nextReassessmentAt: string | null;
  policyContext: RecoveryPolicyContext | null;
}

export interface RecoveryPlanInput {
  safetyMode: SafetyMode;
  readiness: ApplicationReadiness;
  diagnosis: BarrierDiagnosis;
  passport: CreditPassport;
  nextMission: RecoveryMissionSummary | null;
  policyContext?: RecoveryPolicyContext | null;
}

const CUSTOMER_HEADLINE: Record<RecoveryPolicyContext["treatment"], string> = {
  fix: "There may be information to check or correct before you try again.",
  build: "Your credit history may need more reliable evidence before you check again.",
  stabilise: "Strengthening financial stability now could improve your position later.",
  create_headroom: "Focus on improving sustainable monthly breathing room before another commitment.",
  wait_and_rebuild: "Some parts of this position need time as well as positive evidence.",
  longer_term_recovery: "This needs a longer-term recovery path rather than another near-term application.",
  find_a_better_fit: "The original product may not have been the right fit, subject to fresh Credit Quest safety and readiness checks.",
  needs_evidence: "We need more information before we can say there was one specific cause.",
  restricted: "This decision sits outside the normal Credit Quest recovery route.",
};

function normalised(value: string): string {
  return value.trim().toUpperCase();
}

function snapshotReasonForPrimary(
  snapshot: RecoveryPolicySnapshot,
  resolution: BarrierResolution,
) {
  const primary = resolution.primary;
  if (!primary) return null;

  if (primary.canonicalCode) {
    return snapshot.partnerReasons.find((reason) => reason.canonicalCode === primary.canonicalCode) ?? null;
  }

  return snapshot.partnerReasons.find((reason) => (
    reason.canonicalCode === null && normalised(reason.externalCode) === primary.code
  )) ?? null;
}

export function buildRecoveryPolicyContext(
  snapshot: RecoveryPolicySnapshot,
  resolution: BarrierResolution,
): RecoveryPolicyContext | null {
  if (!snapshot.usePartnerReasonsForTreatment || !resolution.primary) return null;

  const frozenReason = snapshotReasonForPrimary(snapshot, resolution);
  const treatment = frozenReason?.treatment ?? resolution.primary.treatment;
  const solveability = frozenReason?.solveability ?? resolution.primary.solveability;
  const restricted = resolution.primary.restricted
    || Boolean(frozenReason?.restricted)
    || snapshot.partnerReasons.some((reason) => reason.restricted);
  const hasAlternativePolicy = Boolean(frozenReason?.alternativeRoutePolicyIds.length);

  return {
    treatment,
    solveability,
    primaryReasonCode: resolution.primary.canonicalCode,
    customerHeadline: CUSTOMER_HEADLINE[treatment],
    originalProductBlocked: true,
    alternativeRoutePotential: !restricted
      && !resolution.alternativeCreditSuppressed
      && solveability === "product_routeable"
      && hasAlternativePolicy,
  };
}

function stageFor(input: Pick<RecoveryPlanInput, "safetyMode" | "readiness">): RecoveryStage {
  if (input.safetyMode === "safe_mode") return "crisis_recovery";
  switch (input.readiness.state) {
    case "red": return "stability";
    case "amber": return "rebuilding";
    case "green": return "ready_to_check";
    case "unknown": return "intake";
  }
}

function validIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function reassessmentDate(input: RecoveryPlanInput): string | null {
  const candidates = [validIso(input.readiness.reassessAt)];
  if (input.safetyMode !== "safe_mode") {
    candidates.push(validIso(input.nextMission?.nextReviewAt));
  }
  return candidates
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;
}

function evidenceGaps(passport: CreditPassport): string[] {
  return [...new Set(
    passport.pillars.flatMap((pillar) => pillar.unknowns.map((item) => item.trim()).filter(Boolean)),
  )];
}

function nextAction(input: RecoveryPlanInput, gaps: string[]): RecoveryNextSafeAction {
  if (input.safetyMode === "safe_mode") {
    return {
      kind: "stabilise",
      title: "Protect essential payments and financial stability first",
      missionSlug: null,
    };
  }

  if (input.policyContext?.treatment === "restricted") {
    return {
      kind: "evidence",
      title: "This decision is outside the normal Credit Quest recovery route",
      missionSlug: null,
    };
  }

  if (input.readiness.state === "green") {
    return {
      kind: "ready_to_check",
      title: "You may be ready to check eligibility",
      missionSlug: null,
    };
  }

  if (input.nextMission) {
    return {
      kind: "mission",
      title: input.nextMission.title,
      missionSlug: input.nextMission.slug,
    };
  }

  return {
    kind: "evidence",
    title: gaps[0] ?? "Keep your Credit Quest evidence up to date",
    missionSlug: null,
  };
}

function safePolicyContext(input: RecoveryPlanInput): RecoveryPolicyContext | null {
  const context = input.policyContext ?? null;
  if (!context || input.safetyMode !== "safe_mode" || !context.alternativeRoutePotential) return context;
  return { ...context, alternativeRoutePotential: false };
}

export function buildRecoveryPlan(input: RecoveryPlanInput): RecoveryPlanProjection {
  // Diagnosis remains part of the independent Credit Quest guidance contract.
  // Lender policy supplies downstream explanation only; safety/readiness still
  // determine stage and the existing mission engine still supplies nextMission.
  void input.diagnosis;

  const gaps = evidenceGaps(input.passport);
  return {
    stage: stageFor(input),
    readinessState: toRecoveryReadinessState(input.readiness.state),
    nextSafeAction: nextAction(input, gaps),
    evidenceGaps: gaps,
    nextReassessmentAt: reassessmentDate(input),
    policyContext: safePolicyContext(input),
  };
}

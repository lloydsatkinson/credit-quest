import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
} from "@/lib/domain/types";
import type { SafetyMode } from "@/lib/domain/safety";
import { toRecoveryReadinessState } from "@/lib/recovery/readiness";
import type { RecoveryReadinessState } from "@/lib/recovery/types";

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
}

export interface RecoveryPlanInput {
  safetyMode: SafetyMode;
  readiness: ApplicationReadiness;
  diagnosis: BarrierDiagnosis;
  passport: CreditPassport;
  nextMission: RecoveryMissionSummary | null;
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

export function buildRecoveryPlan(input: RecoveryPlanInput): RecoveryPlanProjection {
  // Diagnosis is deliberately consumed as part of the independent Credit Quest
  // guidance contract, but it does not allow partner decline context to mutate
  // recovery stage or readiness. The current stage is driven by safety/readiness.
  void input.diagnosis;

  const gaps = evidenceGaps(input.passport);
  return {
    stage: stageFor(input),
    readinessState: toRecoveryReadinessState(input.readiness.state),
    nextSafeAction: nextAction(input, gaps),
    evidenceGaps: gaps,
    nextReassessmentAt: reassessmentDate(input),
  };
}

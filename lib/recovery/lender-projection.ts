import type { ActionAttemptStatus } from "@/lib/domain/types";
import type { JourneyLifecycleStage } from "@/lib/journey/types";
import type {
  EvidenceConfidence,
  RecoveryExperienceState,
} from "@/lib/recovery/experience";
import type { RecoveryStage } from "@/lib/recovery/plan";
import type { RecoveryReadinessState } from "@/lib/recovery/types";

export type LenderDemoWindowDays = 7 | 30 | 90;
export type LenderDemoView = "overview" | "pipeline" | "cohorts" | "status";
export type LenderCohortGranularity = "week" | "month";

export interface LenderRate {
  numerator: number | null;
  denominator: number;
  percentage: number | null;
}

export interface LenderOverviewInput {
  handoffs: number;
  activations: number;
  firstActions: number | null;
  reassessments: number | null;
  readyToCheck: number;
  voluntaryReturns: number | null;
  averageTimeToFirstActionHours: number | null;
  suppressionReasons: Record<string, number> | null;
}

export interface LenderOverviewProjection extends LenderOverviewInput {
  activationRate: LenderRate;
  firstActionRate: LenderRate;
  recoveryRate: LenderRate;
  voluntaryReturnRate: LenderRate;
}

export interface LenderDisplayActionAttempt {
  status: ActionAttemptStatus;
  nextReviewAt: string | null;
  verifiedAt: string | null;
}

export interface LenderRecoveryStateInput {
  recoveryStage: RecoveryStage;
  readinessState: RecoveryReadinessState | null;
  journeyStage: JourneyLifecycleStage | null;
  activeMissionId: string | null;
  openAttempt: LenderDisplayActionAttempt | null;
  now: Date;
}

export interface LenderPipelineInclusionInput {
  completedAt: string | null;
  finalActivityAt: string | null;
}

export interface LenderCohortInput {
  cohortAt: string;
  activated: boolean;
  firstActionAt: string | null;
  readyToCheckAt: string | null;
  voluntaryReturnAt: string | null;
}

export interface LenderCohortProjection {
  bucket: string;
  handoffs: number;
  activations: number;
  firstActions: number;
  readyToCheck: number;
  voluntaryReturns: number;
  activationRate: LenderRate;
  firstActionRate: LenderRate;
  recoveryRate: LenderRate;
  voluntaryReturnRate: LenderRate;
}

const OPEN_ATTEMPT_STATUSES: ActionAttemptStatus[] = ["started", "returned", "submitted"];

export function calculateLenderRate(
  numerator: number | null,
  denominator: number,
): LenderRate {
  return {
    numerator,
    denominator,
    percentage: numerator === null || denominator <= 0
      ? null
      : Number(((numerator / denominator) * 100).toFixed(1)),
  };
}

export function buildLenderOverviewProjection(
  input: LenderOverviewInput,
): LenderOverviewProjection {
  return {
    ...input,
    activationRate: calculateLenderRate(input.activations, input.handoffs),
    firstActionRate: calculateLenderRate(input.firstActions, input.activations),
    recoveryRate: calculateLenderRate(input.readyToCheck, input.activations),
    voluntaryReturnRate: calculateLenderRate(input.voluntaryReturns, input.readyToCheck),
  };
}

function validTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function isFuture(value: string | null | undefined, now: Date): boolean {
  const time = validTime(value);
  return time !== null && time > now.getTime();
}

function isWaitingAttempt(
  attempt: LenderDisplayActionAttempt | null,
  now: Date,
): boolean {
  return Boolean(
    attempt
    && OPEN_ATTEMPT_STATUSES.includes(attempt.status)
    && attempt.verifiedAt === null
    && isFuture(attempt.nextReviewAt, now),
  );
}

export function deriveLenderRecoveryState(
  input: LenderRecoveryStateInput,
): RecoveryExperienceState {
  if (
    input.recoveryStage === "ready_to_check"
    && input.readinessState === "ready_to_check"
  ) {
    return "ready_to_check";
  }

  if (input.journeyStage === "reassessment_due") {
    return "reassessment_due";
  }

  if (input.journeyStage === "active_mission" && input.activeMissionId) {
    return "action_required";
  }

  if (isWaitingAttempt(input.openAttempt, input.now)) {
    return "waiting_for_evidence";
  }

  return "not_ready";
}

export function summariseLenderEvidenceConfidence(
  attempts: LenderDisplayActionAttempt[],
  now: Date,
): EvidenceConfidence {
  if (attempts.some((attempt) => attempt.status === "verified" || attempt.verifiedAt !== null)) {
    return "verified";
  }

  if (attempts.some((attempt) => (
    attempt.verifiedAt === null
    && isFuture(attempt.nextReviewAt, now)
    && [...OPEN_ATTEMPT_STATUSES, "self_confirmed" as const].includes(attempt.status)
  ))) {
    return "pending";
  }

  if (attempts.some((attempt) => attempt.status === "self_confirmed")) {
    return "confirmed";
  }

  return "unknown";
}

export function shouldIncludeLenderPipelineJourney(
  journey: LenderPipelineInclusionInput,
  from: Date,
): boolean {
  if (journey.completedAt === null) return true;
  const finalActivity = validTime(journey.finalActivityAt);
  return finalActivity !== null && finalActivity >= from.getTime();
}

function utcDatePart(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cohortBucket(value: string, granularity: LenderCohortGranularity): string | null {
  const time = validTime(value);
  if (time === null) return null;
  const date = new Date(time);

  if (granularity === "month") {
    return utcDatePart(date).slice(0, 7);
  }

  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  return utcDatePart(date);
}

interface MutableCohortCounts {
  handoffs: number;
  activations: number;
  firstActions: number;
  readyToCheck: number;
  voluntaryReturns: number;
}

export function buildLenderCohorts(
  inputs: LenderCohortInput[],
  granularity: LenderCohortGranularity,
): LenderCohortProjection[] {
  const countsByBucket = new Map<string, MutableCohortCounts>();

  for (const input of inputs) {
    const bucket = cohortBucket(input.cohortAt, granularity);
    if (!bucket) continue;

    const counts = countsByBucket.get(bucket) ?? {
      handoffs: 0,
      activations: 0,
      firstActions: 0,
      readyToCheck: 0,
      voluntaryReturns: 0,
    };

    counts.handoffs += 1;
    if (input.activated) counts.activations += 1;
    if (input.firstActionAt) counts.firstActions += 1;
    if (input.readyToCheckAt) counts.readyToCheck += 1;
    if (input.voluntaryReturnAt) counts.voluntaryReturns += 1;
    countsByBucket.set(bucket, counts);
  }

  return [...countsByBucket.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, counts]) => ({
      bucket,
      ...counts,
      activationRate: calculateLenderRate(counts.activations, counts.handoffs),
      firstActionRate: calculateLenderRate(counts.firstActions, counts.activations),
      recoveryRate: calculateLenderRate(counts.readyToCheck, counts.activations),
      voluntaryReturnRate: calculateLenderRate(counts.voluntaryReturns, counts.readyToCheck),
    }));
}

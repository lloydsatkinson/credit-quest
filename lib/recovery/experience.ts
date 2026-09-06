import type {
  ActionAttemptStatus,
  ApplicationReadiness,
  ImpactLevel,
  RankedMissionInstance,
} from "@/lib/domain/types";
import type { JourneyState } from "@/lib/journey/types";
import type { RecoveryPlanProjection } from "@/lib/recovery/plan";

export type RecoveryExperienceState =
  | "action_required"
  | "waiting_for_evidence"
  | "reassessment_due"
  | "not_ready"
  | "ready_to_check";

export type EvidenceConfidence = "verified" | "confirmed" | "pending" | "unknown";

export type RecoveryEvidenceSource =
  | "customer"
  | "account"
  | "partner"
  | "government_action"
  | "cra"
  | "open_banking"
  | "eligibility_provider"
  | "unknown";

export interface RecoveryEvidenceItem {
  key: string;
  label: string;
  confidence: EvidenceConfidence;
  source: RecoveryEvidenceSource;
  statusText: string;
}

export interface RecoveryTimelineItem {
  key: "declined" | "fixing" | "waiting" | "reassessment" | "ready";
  label: string;
  state: "complete" | "current" | "future";
}

export type RecoveryReturnState =
  | { status: "unavailable"; reason: string; partnerLabel: string | null }
  | { status: "blocked"; reason: string; partnerLabel: string | null }
  | { status: "available"; reason: null; partnerLabel: string };

export interface RecoveryOpenAttempt {
  missionInstanceId: string;
  status: ActionAttemptStatus;
  nextReviewAt: string | null;
  verifiedAt: string | null;
}

export interface RecoveryExperienceProjection {
  mode: "recovery";
  recoveryJourneyId: string;
  stage: RecoveryPlanProjection["stage"];
  state: RecoveryExperienceState;
  headline: string;
  summary: string;
  nextAction: {
    missionInstanceId: string | null;
    missionSlug: string | null;
    title: string;
    rationale: string;
    actionHref: string | null;
    impactLabel: ImpactLevel | null;
    effortLabel: string | null;
    reviewTimingLabel: string | null;
  };
  evidence: RecoveryEvidenceItem[];
  timeline: RecoveryTimelineItem[];
  readiness: {
    status: ApplicationReadiness["state"];
    explanation: string;
  };
  reassessment: {
    dueAt: string | null;
    label: string;
  };
  returnState: RecoveryReturnState;
}

export interface RecoveryExperienceInput {
  recoveryJourneyId: string;
  origin: "direct" | "partner";
  plan: RecoveryPlanProjection;
  readiness: ApplicationReadiness;
  nextMission: RankedMissionInstance | null;
  openAttempt: RecoveryOpenAttempt | null;
  journeyState: JourneyState | null;
  now: Date;
  evidence: RecoveryEvidenceItem[];
  returnState: RecoveryReturnState;
}

const TIMELINE: Array<Pick<RecoveryTimelineItem, "key" | "label">> = [
  { key: "declined", label: "Declined" },
  { key: "fixing", label: "Fixing now" },
  { key: "waiting", label: "Evidence pending" },
  { key: "reassessment", label: "Reassessment" },
  { key: "ready", label: "Ready" },
];

function isFuture(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > now.getTime();
}

function stateFor(input: RecoveryExperienceInput): RecoveryExperienceState {
  if (input.readiness.state === "green" && input.plan.stage === "ready_to_check") {
    return "ready_to_check";
  }

  if (input.journeyState?.stage === "reassessment_due") {
    return "reassessment_due";
  }

  if (input.nextMission) {
    return "action_required";
  }

  if (input.openAttempt && isFuture(input.openAttempt.nextReviewAt, input.now)) {
    return "waiting_for_evidence";
  }

  return "not_ready";
}

function currentTimelineKey(state: RecoveryExperienceState): RecoveryTimelineItem["key"] {
  switch (state) {
    case "waiting_for_evidence":
      return "waiting";
    case "reassessment_due":
      return "reassessment";
    case "ready_to_check":
      return "ready";
    case "action_required":
    case "not_ready":
      return "fixing";
  }
}

function timelineFor(state: RecoveryExperienceState): RecoveryTimelineItem[] {
  const currentKey = currentTimelineKey(state);
  const currentIndex = TIMELINE.findIndex((item) => item.key === currentKey);

  return TIMELINE.map((item, index) => ({
    ...item,
    state: index < currentIndex ? "complete" : index === currentIndex ? "current" : "future",
  }));
}

function firstReason(input: RecoveryExperienceInput): string {
  return input.plan.evidenceGaps[0]
    ?? input.readiness.reasons[0]
    ?? "Your current evidence does not yet support another eligibility check.";
}

function copyFor(
  state: RecoveryExperienceState,
  input: RecoveryExperienceInput,
): Pick<RecoveryExperienceProjection, "headline" | "summary"> {
  switch (state) {
    case "action_required":
      return {
        headline: "Here’s the most useful thing to do next.",
        summary: input.nextMission?.reasons[0]
          ?? input.nextMission?.mission.rationale
          ?? firstReason(input),
      };
    case "waiting_for_evidence":
      return {
        headline: "You’ve done what you need to do for now.",
        summary: "We’re waiting for this action or evidence to reach its genuine review point before reassessing your position.",
      };
    case "reassessment_due":
      return {
        headline: "It’s time to check what changed.",
        summary: "Your evidence-based reassessment point has arrived. Credit Quest can now re-run the same independent guidance using what we currently know.",
      };
    case "ready_to_check":
      return {
        headline: "You’ve made the progress we were waiting for.",
        summary: "Based on the information we have, you’re ready to check eligibility again. This is not a guarantee of acceptance.",
      };
    case "not_ready":
      return {
        headline: "You’re not ready to check eligibility yet.",
        summary: firstReason(input),
      };
  }
}

function nextActionFor(
  state: RecoveryExperienceState,
  input: RecoveryExperienceInput,
): RecoveryExperienceProjection["nextAction"] {
  if (state === "action_required" && input.nextMission) {
    const { mission, instance } = input.nextMission;
    return {
      missionInstanceId: instance.id,
      missionSlug: mission.slug,
      title: mission.title,
      rationale: input.nextMission.reasons[0] ?? mission.rationale,
      actionHref: `/actions/${instance.id}`,
      impactLabel: mission.impact,
      effortLabel: null,
      reviewTimingLabel: mission.reviewPeriodDays
        ? `around ${mission.reviewPeriodDays} days`
        : null,
    };
  }

  if (state === "reassessment_due") {
    return {
      missionInstanceId: null,
      missionSlug: null,
      title: "Reassess your Credit Quest position",
      rationale: "The evidence-based review point has arrived.",
      actionHref: null,
      impactLabel: null,
      effortLabel: null,
      reviewTimingLabel: null,
    };
  }

  return {
    missionInstanceId: null,
    missionSlug: input.plan.nextSafeAction.missionSlug,
    title: input.plan.nextSafeAction.title,
    rationale: firstReason(input),
    actionHref: null,
    impactLabel: null,
    effortLabel: null,
    reviewTimingLabel: null,
  };
}

function validIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function reassessmentFor(
  state: RecoveryExperienceState,
  input: RecoveryExperienceInput,
): RecoveryExperienceProjection["reassessment"] {
  const dueAt = state === "waiting_for_evidence"
    ? validIso(input.openAttempt?.nextReviewAt)
    : validIso(input.journeyState?.nextReassessmentAt)
      ?? validIso(input.plan.nextReassessmentAt);

  if (!dueAt) {
    return {
      dueAt: null,
      label: "No reassessment date is being guessed. We’ll show one only when real dated evidence supports it.",
    };
  }

  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dueAt));

  return {
    dueAt,
    label: state === "reassessment_due"
      ? `Reassessment due from ${formatted}.`
      : `Next evidence-based reassessment: ${formatted}.`,
  };
}

export function buildRecoveryExperienceProjection(
  input: RecoveryExperienceInput,
): RecoveryExperienceProjection {
  const state = stateFor(input);
  const copy = copyFor(state, input);

  return {
    mode: "recovery",
    recoveryJourneyId: input.recoveryJourneyId,
    stage: input.plan.stage,
    state,
    ...copy,
    nextAction: nextActionFor(state, input),
    evidence: input.evidence,
    timeline: timelineFor(state),
    readiness: {
      status: input.readiness.state,
      explanation: input.readiness.headline,
    },
    reassessment: reassessmentFor(state, input),
    returnState: input.returnState,
  };
}

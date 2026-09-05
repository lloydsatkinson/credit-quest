import { describe, expect, it } from "vitest";
import { buildRecoveryExperienceProjection } from "@/lib/recovery/experience";
import type {
  ApplicationReadiness,
  RankedMissionInstance,
} from "@/lib/domain/types";
import type { JourneyState } from "@/lib/journey/types";
import type { RecoveryPlanProjection } from "@/lib/recovery/plan";

const now = new Date("2026-09-05T12:00:00.000Z");

const readiness: ApplicationReadiness = {
  state: "amber",
  headline: "Not quite ready yet",
  reasons: ["More evidence is needed."],
  avoid: ["Avoid another application for now."],
  actions: ["Complete your next action."],
  reassessAt: null,
  daysUntilReassessment: null,
};

const plan: RecoveryPlanProjection = {
  stage: "rebuilding",
  readinessState: "getting_closer",
  nextSafeAction: {
    kind: "mission",
    title: "Register on the electoral roll",
    missionSlug: "register-electoral-roll",
  },
  evidenceGaps: ["Electoral roll status is not yet confirmed."],
  nextReassessmentAt: null,
};

const journeyState: JourneyState = {
  userId: "user-1",
  stage: "active_mission",
  activeMissionId: "instance-1",
  nextReassessmentAt: null,
  lastReassessedAt: null,
  lastReadinessBand: "amber",
  updatedAt: "2026-09-05T10:00:00.000Z",
};

const nextMission = {
  mission: {
    id: "mission-1",
    slug: "register-electoral-roll",
    title: "Register on the electoral roll",
    description: "Register your current address.",
    rationale: "Identity and address consistency can matter to lenders.",
    stage: "build",
    impact: "high",
    questScoreDelta: 100,
    priorityWeight: 100,
    safeModeAllowed: true,
    scope: "profile",
    reviewPeriodDays: 35,
    isEligible: () => true,
  },
  instance: {
    id: "instance-1",
    userId: "user-1",
    missionSlug: "register-electoral-roll",
    subject: { kind: "profile" },
    state: "eligible",
    startedAt: null,
    completedAt: null,
    nextReviewAt: null,
  },
  priorityScore: 100,
  reasons: ["Your electoral-roll status is not confirmed."],
} satisfies RankedMissionInstance;

function input(overrides: Record<string, unknown> = {}) {
  return {
    recoveryJourneyId: "recovery-1",
    origin: "direct" as const,
    plan,
    readiness,
    nextMission: null,
    openAttempt: null,
    journeyState,
    now,
    evidence: [],
    returnState: {
      status: "unavailable" as const,
      reason: "direct_recovery",
      partnerLabel: null,
    },
    ...overrides,
  };
}

describe("RecoveryExperienceProjection", () => {
  it("uses action_required when there is an eligible next mission", () => {
    const result = buildRecoveryExperienceProjection(input({ nextMission }));

    expect(result.state).toBe("action_required");
    expect(result.nextAction).toMatchObject({
      missionInstanceId: "instance-1",
      missionSlug: "register-electoral-roll",
      title: "Register on the electoral roll",
      actionHref: "/actions/instance-1",
      impactLabel: "high",
    });
  });

  it("uses waiting_for_evidence for an open submitted action with a genuine future review date", () => {
    const result = buildRecoveryExperienceProjection(input({
      openAttempt: {
        missionInstanceId: "instance-1",
        status: "submitted",
        nextReviewAt: "2026-10-05T09:00:00.000Z",
        verifiedAt: null,
      },
    }));

    expect(result.state).toBe("waiting_for_evidence");
    expect(result.reassessment.dueAt).toBe("2026-10-05T09:00:00.000Z");
  });

  it("uses reassessment_due when Journey says reassessment is due", () => {
    const result = buildRecoveryExperienceProjection(input({
      journeyState: {
        ...journeyState,
        stage: "reassessment_due",
        nextReassessmentAt: "2026-09-05T09:00:00.000Z",
      },
    }));

    expect(result.state).toBe("reassessment_due");
  });

  it("uses not_ready rather than a generic up-to-date state when no action is available", () => {
    const result = buildRecoveryExperienceProjection(input());

    expect(result.state).toBe("not_ready");
    expect(result.headline.toLowerCase()).not.toContain("up to date");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("uses ready_to_check from independent Credit Quest readiness even when return is unavailable", () => {
    const result = buildRecoveryExperienceProjection(input({
      plan: {
        ...plan,
        stage: "ready_to_check",
        readinessState: "ready_to_check",
        nextSafeAction: {
          kind: "ready_to_check",
          title: "You may be ready to check eligibility",
          missionSlug: null,
        },
        evidenceGaps: [],
      },
      readiness: {
        ...readiness,
        state: "green",
        headline: "You may be ready to check eligibility",
      },
      returnState: {
        status: "unavailable",
        reason: "direct_recovery",
        partnerLabel: null,
      },
    }));

    expect(result.state).toBe("ready_to_check");
    expect(result.returnState.status).toBe("unavailable");
  });

  it("does not let a blocked return route downgrade independent ready_to_check", () => {
    const result = buildRecoveryExperienceProjection(input({
      plan: {
        ...plan,
        stage: "ready_to_check",
        readinessState: "ready_to_check",
        nextSafeAction: {
          kind: "ready_to_check",
          title: "You may be ready to check eligibility",
          missionSlug: null,
        },
        evidenceGaps: [],
      },
      readiness: { ...readiness, state: "green" },
      returnState: {
        status: "blocked",
        reason: "gateway_disabled",
        partnerLabel: "Example Lender",
      },
    }));

    expect(result.state).toBe("ready_to_check");
    expect(result.returnState).toMatchObject({ status: "blocked", reason: "gateway_disabled" });
  });

  it("does not treat a non-green recovery plan as ready even if a return state is marked available", () => {
    const result = buildRecoveryExperienceProjection(input({
      returnState: {
        status: "available",
        reason: null,
        partnerLabel: "Example Lender",
      },
    }));

    expect(result.state).toBe("not_ready");
  });
});

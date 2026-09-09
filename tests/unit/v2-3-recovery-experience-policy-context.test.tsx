import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecoveryHero } from "@/components/recovery/recovery-hero";
import type { ApplicationReadiness, RankedMissionInstance } from "@/lib/domain/types";
import { buildRecoveryExperienceProjection } from "@/lib/recovery/experience";
import type { RecoveryPlanProjection } from "@/lib/recovery/plan";

vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => cleanup());

const readiness: ApplicationReadiness = {
  state: "amber",
  headline: "Not quite ready yet",
  reasons: ["More evidence is needed."],
  avoid: ["Avoid another application for now."],
  actions: ["Complete your next action."],
  reassessAt: null,
  daysUntilReassessment: null,
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

function projectionInput(plan: RecoveryPlanProjection, mission: RankedMissionInstance | null = nextMission) {
  return {
    recoveryJourneyId: "recovery-1",
    origin: "partner" as const,
    plan,
    readiness,
    nextMission: mission,
    openAttempt: null,
    journeyState: null,
    now: new Date("2026-09-09T12:00:00.000Z"),
    evidence: [],
    returnState: {
      status: "unavailable" as const,
      reason: "readiness_not_ready_to_check",
      partnerLabel: "Example Lender",
    },
  };
}

function basePlan(policyContext: RecoveryPlanProjection["policyContext"]): RecoveryPlanProjection {
  return {
    stage: "rebuilding",
    readinessState: "getting_closer",
    nextSafeAction: {
      kind: "mission",
      title: "Register on the electoral roll",
      missionSlug: "register-electoral-roll",
    },
    evidenceGaps: ["More evidence is needed."],
    nextReassessmentAt: null,
    policyContext,
  };
}

describe("V2.3 recovery policy context presentation", () => {
  it("shows configured decline context beneath the existing Credit Quest action without replacing it", () => {
    const policyContext: NonNullable<RecoveryPlanProjection["policyContext"]> = {
      treatment: "fix",
      solveability: "fix_now",
      primaryReasonCode: "CAIS_DUPLICATE",
      customerHeadline: "There may be information to check or correct before you try again.",
      originalProductBlocked: true,
      alternativeRoutePotential: false,
    };
    const result = buildRecoveryExperienceProjection(projectionInput(basePlan(policyContext)));

    expect(result.state).toBe("action_required");
    expect(result.nextAction).toMatchObject({
      missionSlug: "register-electoral-roll",
      title: "Register on the electoral roll",
    });
    expect((result as typeof result & { policyContext?: unknown }).policyContext).toEqual(policyContext);

    render(<RecoveryHero projection={result} />);
    expect(screen.getByText(/information to check or correct/i)).not.toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("keeps restricted fraud/security decisions outside action_required even if a ranked mission exists", () => {
    const restrictedPlan: RecoveryPlanProjection = {
      ...basePlan({
        treatment: "restricted",
        solveability: "restricted",
        primaryReasonCode: "FRAUD_SECURITY_DECISION",
        customerHeadline: "This decision sits outside the normal Credit Quest recovery route.",
        originalProductBlocked: true,
        alternativeRoutePotential: false,
      }),
      nextSafeAction: {
        kind: "evidence",
        title: "This decision is outside the normal Credit Quest recovery route",
        missionSlug: null,
      },
    };

    const result = buildRecoveryExperienceProjection(projectionInput(restrictedPlan));

    expect(result.state).toBe("not_ready");
    expect(result.nextAction.missionInstanceId).toBeNull();
    expect(result.nextAction.actionHref).toBeNull();
    expect(result.nextAction.title.toLowerCase()).toMatch(/outside|security/);
  });
});

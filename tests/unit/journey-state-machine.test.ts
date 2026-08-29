import { describe, expect, it } from "vitest";
import { deriveJourneyLifecycle } from "@/lib/journey/state-machine";
import type { ApplicationReadiness, MissionInstance } from "@/lib/domain/types";

function readiness(state: ApplicationReadiness["state"]): ApplicationReadiness {
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

function mission(state: MissionInstance["state"], nextReviewAt: string | null = null): MissionInstance {
  return {
    id: "m1",
    userId: "u1",
    missionSlug: "application-cooldown",
    subject: { kind: "profile" },
    state,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: null,
    nextReviewAt,
  };
}

const now = new Date("2026-08-29T08:00:00.000Z");

describe("deriveJourneyLifecycle", () => {
  it("prioritises a due reassessment", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("amber"),
      activeMission: mission("cooldown", "2026-08-29T07:59:00.000Z"),
      nextReassessmentAt: "2026-08-29T07:59:00.000Z",
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("reassessment_due");
  });

  it("keeps an undued cooldown in cooldown", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("red"),
      activeMission: mission("cooldown", "2026-09-29T08:00:00.000Z"),
      nextReassessmentAt: "2026-09-29T08:00:00.000Z",
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("cooldown");
  });

  it("uses active_mission for a started mission", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("amber"),
      activeMission: mission("started"),
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("active_mission");
  });

  it("uses onboarding before onboarding is complete", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("unknown"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: false,
      now,
    })).toBe("onboarding");
  });

  it("uses ready for green with no pending work", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("green"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("ready");
  });

  it("uses optimising after completed work when still green", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("green"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: true,
      onboardingComplete: true,
      now,
    })).toBe("optimising");
  });

  it("uses waiting for non-green with no active work", () => {
    expect(deriveJourneyLifecycle({
      readiness: readiness("unknown"),
      activeMission: null,
      nextReassessmentAt: null,
      hasCompletedMission: false,
      onboardingComplete: true,
      now,
    })).toBe("waiting");
  });
});

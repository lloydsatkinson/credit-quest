import type { ApplicationReadiness, MissionInstance } from "@/lib/domain/types";
import type { JourneyLifecycleStage } from "@/lib/journey/types";

export function deriveJourneyLifecycle(input: {
  readiness: ApplicationReadiness;
  activeMission: MissionInstance | null;
  nextReassessmentAt: string | null;
  hasCompletedMission: boolean;
  onboardingComplete: boolean;
  now: Date;
}): JourneyLifecycleStage {
  if (!input.onboardingComplete) return "onboarding";

  if (
    input.nextReassessmentAt
    && new Date(input.nextReassessmentAt).getTime() <= input.now.getTime()
  ) {
    return "reassessment_due";
  }

  if (input.activeMission?.state === "cooldown") return "cooldown";
  if (input.activeMission?.state === "started") return "active_mission";

  if (input.readiness.state === "green") {
    return input.hasCompletedMission ? "optimising" : "ready";
  }

  return "waiting";
}

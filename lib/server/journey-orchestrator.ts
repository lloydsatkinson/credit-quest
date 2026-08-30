import { createJourneyOrchestrator } from "@/lib/journey/orchestrator";
import type { JourneyOutcome, JourneyOutcomeSource, JourneyOutcomeType } from "@/lib/journey/types";
import {
  appendJourneyOutcome,
  getJourneyState,
  upsertJourneyState,
} from "@/lib/server/journey-repository";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { listMissionInstances } from "@/lib/server/mission-repository";
import { getUserProfile } from "@/lib/server/profile-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type { JourneyReassessmentResult } from "@/lib/journey/orchestrator";

async function productionOrchestrator() {
  const [server, admin] = await Promise.all([
    createServerSupabaseClient(),
    Promise.resolve(createAdminSupabaseClient()),
  ]);

  return createJourneyOrchestrator({
    appendOutcome: (input) => appendJourneyOutcome(admin, input),
    upsertState: (state) => upsertJourneyState(admin, state),
    getState: (userId) => getJourneyState(server, userId),
    getGuidance: async (userId, now) => {
      const guidance = await getCreditGuidanceForUser(server, userId, now);
      return guidance ? { readiness: guidance.readiness } : null;
    },
    getMissionContext: async (userId) => {
      const [profile, missions] = await Promise.all([
        getUserProfile(server, userId),
        listMissionInstances(server, userId),
      ]);
      const activeMission = missions.find((mission) =>
        ["started", "cooldown", "in_review", "deferred"].includes(mission.state),
      ) ?? null;
      return {
        activeMission,
        hasCompletedMission: missions.some((mission) => mission.state === "completed"),
        onboardingComplete: profile !== null,
      };
    },
  });
}

export async function observeJourneyEvent(input: {
  userId: string;
  eventType: JourneyOutcomeType;
  source: JourneyOutcomeSource;
  sourceKey: string;
  missionInstanceId?: string | null;
  nextReviewAt?: string | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}): Promise<JourneyOutcome> {
  const orchestrator = await productionOrchestrator();
  return orchestrator.observeJourneyEvent(input);
}

export async function reassessJourneyForUser(input: {
  userId: string;
  sourceKey: string;
  now?: Date;
}) {
  const orchestrator = await productionOrchestrator();
  return orchestrator.reassessJourneyForUser(input);
}

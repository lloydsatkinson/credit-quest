import { createJourneyOrchestrator } from "@/lib/journey/orchestrator";
import type { JourneyOutcome, JourneyOutcomeSource, JourneyOutcomeType } from "@/lib/journey/types";
import {
  appendJourneyOutcome,
  getJourneyState,
  listRecentJourneyOutcomes,
  upsertJourneyState,
} from "@/lib/server/journey-repository";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { listMissionInstances } from "@/lib/server/mission-repository";
import { getUserProfile } from "@/lib/server/profile-repository";
import { scheduleJourneyRemindersForOutcome } from "@/lib/server/reminder-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type { JourneyReassessmentResult } from "@/lib/journey/orchestrator";

async function productionOrchestrator() {
  const [server, admin] = await Promise.all([
    createServerSupabaseClient(),
    Promise.resolve(createAdminSupabaseClient()),
  ]);

  const orchestrator = createJourneyOrchestrator({
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

  return { orchestrator, server };
}

async function scheduleRemindersBestEffort(input: {
  userId: string;
  outcome: JourneyOutcome;
  nextReassessmentAt: string | null;
}) {
  try {
    await scheduleJourneyRemindersForOutcome(input);
  } catch {
    // Reminder scheduling is downstream and cannot invalidate Journey history or guidance.
  }
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
  const { orchestrator, server } = await productionOrchestrator();
  const outcome = await orchestrator.observeJourneyEvent(input);

  try {
    const state = await getJourneyState(server, input.userId);
    await scheduleRemindersBestEffort({
      userId: input.userId,
      outcome,
      nextReassessmentAt: state?.nextReassessmentAt ?? input.nextReviewAt ?? null,
    });
  } catch {
    // A post-persistence reminder read must not invalidate the core Journey event.
  }

  return outcome;
}

export async function reassessJourneyForUser(input: {
  userId: string;
  sourceKey: string;
  now?: Date;
}) {
  const { orchestrator, server } = await productionOrchestrator();
  const result = await orchestrator.reassessJourneyForUser(input);
  if (!result?.changed) return result;

  try {
    const sourceKey = `${input.sourceKey}:readiness:${result.before}:${result.after}`;
    const recent = await listRecentJourneyOutcomes(server, input.userId, 20);
    const readinessOutcome = recent.find((outcome) =>
      outcome.eventType === "readiness_changed" && outcome.sourceKey === sourceKey,
    );
    if (readinessOutcome) {
      await scheduleRemindersBestEffort({
        userId: input.userId,
        outcome: readinessOutcome,
        nextReassessmentAt: result.state.nextReassessmentAt,
      });
    }
  } catch {
    // Reminder scheduling cannot alter the reassessment result.
  }

  return result;
}

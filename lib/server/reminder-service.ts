import "server-only";
import type { JourneyOutcome } from "@/lib/journey/types";
import { deriveReminderCandidates } from "@/lib/reminders/rules";
import {
  getCommunicationPreference,
  scheduleReminder,
} from "@/lib/server/reminder-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface ReminderServiceDeps {
  getPreference: (userId: string) => Promise<{ journeyEmailEnabled: boolean } | null>;
  schedule: (
    userId: string,
    channel: "in_app" | "email",
    candidate: ReturnType<typeof deriveReminderCandidates>[number],
  ) => Promise<unknown>;
}

export function createReminderService(deps: ReminderServiceDeps) {
  return {
    async scheduleForJourneyOutcome(input: {
      userId: string;
      outcome: JourneyOutcome;
      nextReassessmentAt: string | null;
    }) {
      const candidates = deriveReminderCandidates({
        eventType: input.outcome.eventType,
        sourceOutcomeId: input.outcome.id,
        sourceKey: input.outcome.sourceKey,
        occurredAt: input.outcome.occurredAt,
        nextReassessmentAt: input.nextReassessmentAt,
        readinessBefore: input.outcome.readinessBefore,
        readinessAfter: input.outcome.readinessAfter,
      });

      for (const candidate of candidates) {
        await deps.schedule(input.userId, "in_app", candidate);
        let preference: { journeyEmailEnabled: boolean } | null = null;
        try {
          preference = await deps.getPreference(input.userId);
        } catch {
          preference = null;
        }
        if (preference?.journeyEmailEnabled === true) {
          await deps.schedule(input.userId, "email", candidate);
        }
      }
    },
  };
}

export async function scheduleJourneyRemindersForOutcome(input: {
  userId: string;
  outcome: JourneyOutcome;
  nextReassessmentAt: string | null;
}) {
  const admin = createAdminSupabaseClient();
  const service = createReminderService({
    getPreference: (userId) => getCommunicationPreference(admin, userId),
    schedule: (userId, channel, candidate) => scheduleReminder(admin, userId, channel, candidate),
  });
  await service.scheduleForJourneyOutcome(input);
}

import type {
  ReminderCandidate,
  ReminderRuleInput,
  ReminderTemplateKey,
} from "@/lib/reminders/types";

const DAY_MS = 86_400_000;

function candidate(
  input: ReminderRuleInput,
  reason: ReminderCandidate["reason"],
  dueAt: string,
  templateKey: ReminderTemplateKey,
): ReminderCandidate {
  return {
    reason,
    dueAt,
    sourceKey: input.sourceKey,
    sourceOutcomeId: input.sourceOutcomeId,
    templateKey,
  };
}

export function deriveReminderCandidates(input: ReminderRuleInput): ReminderCandidate[] {
  if (input.eventType === "mission_started") {
    return [candidate(
      input,
      "mission_incomplete",
      new Date(new Date(input.occurredAt).getTime() + 3 * DAY_MS).toISOString(),
      "mission-incomplete-v1",
    )];
  }

  if (input.eventType === "cooldown_started" && input.nextReassessmentAt) {
    return [candidate(input, "cooldown_ending", input.nextReassessmentAt, "cooldown-ending-v1")];
  }

  if (
    ["mission_deferred", "action_submitted", "action_verified"].includes(input.eventType) &&
    input.nextReassessmentAt
  ) {
    return [candidate(input, "reassessment_due", input.nextReassessmentAt, "reassessment-due-v1")];
  }

  if (input.eventType === "readiness_changed") {
    return [candidate(input, "readiness_changed", input.occurredAt, "readiness-changed-v1")];
  }

  return [];
}

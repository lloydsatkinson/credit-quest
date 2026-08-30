import { describe, expect, it } from "vitest";
import { deriveReminderCandidates } from "@/lib/reminders/rules";

const start = new Date("2026-08-29T08:00:00.000Z");

describe("deriveReminderCandidates", () => {
  it("schedules an incomplete started mission exactly 72 hours later", () => {
    expect(deriveReminderCandidates({
      eventType: "mission_started",
      sourceOutcomeId: "o1",
      sourceKey: "mission:m1:started",
      occurredAt: start.toISOString(),
      nextReassessmentAt: null,
      readinessBefore: "amber",
      readinessAfter: "amber",
    })).toEqual([{
      reason: "mission_incomplete",
      dueAt: "2026-09-01T08:00:00.000Z",
      sourceKey: "mission:m1:started",
      sourceOutcomeId: "o1",
      templateKey: "mission-incomplete-v1",
    }]);
  });

  it("uses an exact cooldown review timestamp", () => {
    const due = "2026-09-15T10:30:00.000Z";
    expect(deriveReminderCandidates({
      eventType: "cooldown_started",
      sourceOutcomeId: "o2",
      sourceKey: "cooldown:m2",
      occurredAt: start.toISOString(),
      nextReassessmentAt: due,
      readinessBefore: "red",
      readinessAfter: "red",
    })[0]).toMatchObject({ reason: "cooldown_ending", dueAt: due });
  });

  it("makes a readiness-change reminder immediately due", () => {
    expect(deriveReminderCandidates({
      eventType: "readiness_changed",
      sourceOutcomeId: "o3",
      sourceKey: "readiness:o3",
      occurredAt: start.toISOString(),
      nextReassessmentAt: null,
      readinessBefore: "amber",
      readinessAfter: "green",
    })[0]).toMatchObject({ reason: "readiness_changed", dueAt: start.toISOString() });
  });
});

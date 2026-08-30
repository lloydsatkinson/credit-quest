import { describe, expect, it, vi } from "vitest";
import { createReminderService } from "@/lib/server/reminder-service";

const outcome = {
  id: "o1",
  userId: "u1",
  eventType: "mission_started" as const,
  source: "mission" as const,
  sourceKey: "mission:m1:started",
  missionInstanceId: "m1",
  readinessBefore: "amber" as const,
  readinessAfter: "amber" as const,
  metadata: {},
  occurredAt: "2026-08-29T08:00:00.000Z",
};

describe("Reminder Service", () => {
  it("always schedules in-app and only schedules email for persisted opt-in", async () => {
    const schedule = vi.fn().mockResolvedValue({ id: "r1" });
    const service = createReminderService({
      getPreference: vi.fn().mockResolvedValue({ journeyEmailEnabled: true }),
      schedule,
    });

    await service.scheduleForJourneyOutcome({
      userId: "u1",
      outcome,
      nextReassessmentAt: null,
    });

    expect(schedule).toHaveBeenCalledWith("u1", "in_app", expect.any(Object));
    expect(schedule).toHaveBeenCalledWith("u1", "email", expect.any(Object));
  });

  it("fails email scheduling closed when preference is missing", async () => {
    const schedule = vi.fn().mockResolvedValue({ id: "r1" });
    const service = createReminderService({
      getPreference: vi.fn().mockResolvedValue(null),
      schedule,
    });

    await service.scheduleForJourneyOutcome({
      userId: "u1",
      outcome,
      nextReassessmentAt: null,
    });

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith("u1", "in_app", expect.any(Object));
  });

  it("fails email scheduling closed when preference lookup throws", async () => {
    const schedule = vi.fn().mockResolvedValue({ id: "r1" });
    const service = createReminderService({
      getPreference: vi.fn().mockRejectedValue(new Error("down")),
      schedule,
    });

    await service.scheduleForJourneyOutcome({ userId: "u1", outcome, nextReassessmentAt: null });

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith("u1", "in_app", expect.any(Object));
  });
});

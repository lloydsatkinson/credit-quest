import { describe, expect, it } from "vitest";
import { isAttemptReadyToResume } from "@/lib/server/action-repository";
import type { ActionAttempt } from "@/lib/domain/types";

const base: ActionAttempt = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "u1",
  missionInstanceId: "22222222-2222-4222-8222-222222222222",
  actionRegistryId: "33333333-3333-4333-8333-333333333333",
  accountId: null,
  status: "submitted",
  startedAt: "2026-08-26T12:00:00.000Z",
  returnedAt: "2026-08-26T12:05:00.000Z",
  selfConfirmedAt: "2026-08-26T12:05:00.000Z",
  verifiedAt: null,
  nextReviewAt: "2026-09-25T12:00:00.000Z",
};

describe("action attempt resume timing", () => {
  it("hides an attempt until its review date", () => {
    expect(isAttemptReadyToResume(base, new Date("2026-09-24T12:00:00.000Z"))).toBe(false);
  });

  it("surfaces the attempt when its review date is due", () => {
    expect(isAttemptReadyToResume(base, new Date("2026-09-25T12:00:00.000Z"))).toBe(true);
  });

  it("keeps an unfinished attempt with no review date resumable immediately", () => {
    expect(isAttemptReadyToResume({ ...base, status: "returned", nextReviewAt: null }, new Date("2026-08-26T12:06:00.000Z"))).toBe(true);
  });

  it("never resumes terminal attempt statuses", () => {
    expect(isAttemptReadyToResume({ ...base, status: "verified", nextReviewAt: null }, new Date("2026-09-25T12:00:00.000Z"))).toBe(false);
  });
});

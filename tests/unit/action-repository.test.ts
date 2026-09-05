import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findPendingAttemptForMission,
  isAttemptReadyToResume,
  listOpenActionAttempts,
  listPendingActionAttempts,
} from "@/lib/server/action-repository";
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

function row(attempt: ActionAttempt) {
  return {
    id: attempt.id,
    user_id: attempt.userId,
    mission_instance_id: attempt.missionInstanceId,
    action_registry_id: attempt.actionRegistryId,
    account_id: attempt.accountId,
    status: attempt.status,
    started_at: attempt.startedAt,
    returned_at: attempt.returnedAt,
    self_confirmed_at: attempt.selfConfirmedAt,
    verified_at: attempt.verifiedAt,
    next_review_at: attempt.nextReviewAt,
  };
}

function supabaseWithRows(attempts: ActionAttempt[]): SupabaseClient {
  let allowedStatuses: string[] | null = null;
  const query = {
    select: () => query,
    eq: () => query,
    in: (_column: string, statuses: string[]) => {
      allowedStatuses = statuses;
      return query;
    },
    order: async () => ({
      data: attempts
        .filter((attempt) => !allowedStatuses || allowedStatuses.includes(attempt.status))
        .map(row),
      error: null,
    }),
  };

  return {
    from: () => query,
  } as unknown as SupabaseClient;
}

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

  it("finds the existing open attempt for one mission without matching another mission", () => {
    const other = {
      ...base,
      id: "44444444-4444-4444-8444-444444444444",
      missionInstanceId: "55555555-5555-4555-8555-555555555555",
    };

    expect(findPendingAttemptForMission([other, base], base.missionInstanceId)?.id).toBe(base.id);
    expect(findPendingAttemptForMission([other], base.missionInstanceId)).toBeNull();
  });
});

describe("open recovery action visibility", () => {
  it("keeps a submitted future-review attempt visible to recovery while leaving it non-resumable", async () => {
    const supabase = supabaseWithRows([base]);
    const now = new Date("2026-09-24T12:00:00.000Z");

    const open = await listOpenActionAttempts(supabase, base.userId);
    const resumable = await listPendingActionAttempts(supabase, base.userId, now);

    expect(open.map((attempt) => attempt.id)).toContain(base.id);
    expect(resumable.map((attempt) => attempt.id)).not.toContain(base.id);
  });

  it("returns only the existing open statuses and excludes terminal attempts", async () => {
    const started = { ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "started" as const, nextReviewAt: null };
    const returned = { ...base, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "returned" as const, nextReviewAt: null };
    const verified = { ...base, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "verified" as const, nextReviewAt: null };
    const cancelled = { ...base, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "cancelled" as const, nextReviewAt: null };

    const open = await listOpenActionAttempts(
      supabaseWithRows([started, returned, base, verified, cancelled]),
      base.userId,
    );

    expect(open.map((attempt) => attempt.id)).toEqual([
      started.id,
      returned.id,
      base.id,
    ]);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  claimDueEmailReminders,
  clampReminderClaimLimit,
  getCommunicationPreference,
  releaseReminderAfterFailure,
  setJourneyEmailPreference,
} from "@/lib/server/reminder-repository";
import { isFeatureEnabled } from "@/lib/server/feature-flag-repository";

describe("reminder repository", () => {
  it("bounds cron claim size", () => {
    expect(clampReminderClaimLimit(0)).toBe(1);
    expect(clampReminderClaimLimit(50)).toBe(50);
    expect(clampReminderClaimLimit(500)).toBe(100);
  });

  it("fails a runtime flag closed when config cannot be read", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("down") }),
          })),
        })),
      })),
    };
    await expect(isFeatureEnabled(client as never, "email_reminders_enabled")).resolves.toBe(false);
  });

  it("clamps an oversized claim before calling the atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const admin = { rpc };
    const now = new Date("2026-08-30T08:00:00.000Z");
    await claimDueEmailReminders(admin as never, now, 500);
    expect(rpc).toHaveBeenCalledWith("claim_due_journey_reminders", {
      p_limit: 100,
      p_now: now.toISOString(),
    });
  });

  it("persists an explicit email opt-out with its suppression reason", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        user_id: "u1",
        journey_email_enabled: false,
        journey_email_suppressed_at: "2026-08-30T08:00:00.000Z",
        suppression_reason: "user_disabled",
        updated_at: "2026-08-30T08:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const admin = { from: vi.fn(() => ({ upsert })) };
    const now = new Date("2026-08-30T08:00:00.000Z");

    await setJourneyEmailPreference(admin as never, "u1", false, now);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "u1",
      journey_email_enabled: false,
      journey_email_suppressed_at: now.toISOString(),
      suppression_reason: "user_disabled",
    }));
  });

  it("treats a missing communication preference as missing rather than opted in", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        })),
      })),
    };
    await expect(getCommunicationPreference(client as never, "u1")).resolves.toBeNull();
  });

  it("requeues the first two failures and permanently fails the third", async () => {
    const updates: Record<string, unknown>[] = [];
    const admin = {
      from: vi.fn(() => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          updates.push(payload);
          return {
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }),
      })),
    };
    const now = new Date("2026-08-30T08:00:00.000Z");

    await releaseReminderAfterFailure(admin as never, "r1", 1, "provider_unavailable", now);
    await releaseReminderAfterFailure(admin as never, "r2", 3, "provider_unavailable", now);

    expect(updates[0]).toMatchObject({
      status: "scheduled",
      claimed_at: null,
      last_error: "provider_unavailable",
    });
    expect(updates[0].due_at).toBe("2026-08-31T08:00:00.000Z");
    expect(updates[1]).toMatchObject({
      status: "failed",
      claimed_at: null,
      last_error: "provider_unavailable",
    });
  });
});

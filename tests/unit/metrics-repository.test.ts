import { describe, expect, it, vi } from "vitest";
import {
  aggregateV22Metrics,
  getV22Metrics,
} from "@/lib/server/metrics-repository";

describe("V2.2 metrics aggregation", () => {
  it("counts progress outcomes and signed confirmed revenue only", () => {
    const result = aggregateV22Metrics({
      outcomes: [
        { event_type: "onboarding_completed", readiness_before: null, readiness_after: null },
        { event_type: "mission_started", readiness_before: null, readiness_after: null },
        { event_type: "mission_completed", readiness_before: null, readiness_after: null },
        { event_type: "reassessment_performed", readiness_before: "amber", readiness_after: "green" },
        { event_type: "readiness_changed", readiness_before: "amber", readiness_after: "green" },
      ],
      reminders: [{ status: "sent" }],
      referrals: [{ environment: "sandbox" }],
      events: [{ event_name: "referral_consent_accepted" }],
      revenue: [
        { event_type: "revenue", amount_minor: 1200 },
        { event_type: "reversal", amount_minor: 200 },
        { event_type: "click", amount_minor: null },
      ],
    });
    expect(result.journey.missionCompleted).toBe(1);
    expect(result.journey.readinessMovement.amber_to_green).toBe(1);
    expect(result.commercial.confirmedRevenueMinor).toBe(1000);
    expect(result.commercial.revenueEvents).toBe(3);
  });

  it("uses bounded read-only queries and clamps the window", async () => {
    const calls: Array<{ table: string; field: string; from: string }> = [];
    const rows: Record<string, unknown[]> = {
      journey_outcomes: [],
      journey_reminders: [],
      referral_attempts: [],
      revenue_events: [],
      events: [],
    };
    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          gte: vi.fn((field: string, from: string) => {
            calls.push({ table, field, from });
            return Promise.resolve({ data: rows[table], error: null });
          }),
        })),
      })),
    };

    const now = new Date("2026-08-29T08:00:00.000Z");
    const result = await getV22Metrics(client as never, { now, windowDays: 500 });
    expect(result.available).toBe(true);
    if (result.available) expect(result.windowDays).toBe(90);
    expect(calls).toHaveLength(5);
    expect(new Set(calls.map((call) => call.table))).toEqual(new Set(Object.keys(rows)));
    expect(calls.every((call) => call.from === "2026-05-31T08:00:00.000Z")).toBe(true);
    expect(JSON.stringify(client)).not.toMatch(/insert|update|delete|upsert|rpc/);
  });

  it("does not fabricate zero metrics when a required read fails", async () => {
    const client = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({
            data: [],
            error: table === "journey_reminders" ? new Error("down") : null,
          })),
        })),
      })),
    };
    const result = await getV22Metrics(client as never, {
      now: new Date("2026-08-29T08:00:00.000Z"),
      windowDays: 30,
    });
    expect(result).toEqual({ available: false, reason: "unavailable" });
  });
});

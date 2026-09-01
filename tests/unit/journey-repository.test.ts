import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as repository from "@/lib/server/journey-repository";
import {
  appendJourneyOutcome,
  getJourneyState,
  listRecentJourneyOutcomes,
  mapJourneyOutcomeRow,
  mapJourneyStateRow,
} from "@/lib/server/journey-repository";

function fakeRead(data: unknown) {
  const eqCalls: Array<[string, unknown]> = [];
  const limitCalls: number[] = [];
  const query = {
    select: () => query,
    eq: (field: string, value: unknown) => {
      eqCalls.push([field, value]);
      return query;
    },
    order: () => query,
    limit: (value: number) => {
      limitCalls.push(value);
      return query;
    },
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return { query, eqCalls, limitCalls };
}

describe("Journey Repository", () => {
  it("maps journey_state snake case safely", () => {
    expect(mapJourneyStateRow({
      user_id: "u1",
      stage: "waiting",
      active_mission_id: null,
      next_reassessment_at: null,
      last_reassessed_at: null,
      last_readiness_band: "unknown",
      updated_at: "2026-08-29T08:00:00.000Z",
    })).toEqual({
      userId: "u1",
      stage: "waiting",
      activeMissionId: null,
      nextReassessmentAt: null,
      lastReassessedAt: null,
      lastReadinessBand: "unknown",
      updatedAt: "2026-08-29T08:00:00.000Z",
    });
  });

  it("maps journey outcome history", () => {
    expect(mapJourneyOutcomeRow({
      id: "o1",
      user_id: "u1",
      event_type: "reassessment_performed",
      source: "reassessment",
      source_key: "reassessment:u1:2026-09-01T08:00:00.000Z",
      mission_instance_id: null,
      readiness_before: "amber",
      readiness_after: "green",
      metadata: {},
      occurred_at: "2026-09-01T08:00:00.000Z",
    }).readinessAfter).toBe("green");
  });

  it("owner-scopes the current-state read", async () => {
    const read = fakeRead(null);
    const supabase = { from: () => read.query } as unknown as SupabaseClient;
    await getJourneyState(supabase, "u1");
    expect(read.eqCalls).toContainEqual(["user_id", "u1"]);
  });

  it("caps history reads at 100 rows", async () => {
    const read = fakeRead([]);
    const supabase = { from: () => read.query } as unknown as SupabaseClient;
    await listRecentJourneyOutcomes(supabase, "u1", 1000);
    expect(read.eqCalls).toContainEqual(["user_id", "u1"]);
    expect(read.limitCalls).toEqual([100]);
  });

  it("uses the typed user id for an outcome and reuses an exact duplicate", async () => {
    let inserted: Record<string, unknown> | null = null;
    const existing = {
      id: "o1",
      user_id: "u1",
      event_type: "mission_completed",
      source: "mission",
      source_key: "mission:m1:completed:t1",
      mission_instance_id: "m1",
      readiness_before: "amber",
      readiness_after: "amber",
      metadata: {},
      occurred_at: "2026-08-29T08:00:00.000Z",
    };
    const insertQuery = {
      insert: (value: Record<string, unknown>) => {
        inserted = value;
        return insertResult;
      },
    };
    const insertResult = {
      select: () => insertResult,
      maybeSingle: async () => ({ data: null, error: { code: "23505" } }),
    };
    const lookup = fakeRead(existing);
    const admin = {
      from: () => inserted === null ? insertQuery : lookup.query,
    } as unknown as SupabaseClient;

    const result = await appendJourneyOutcome(admin, {
      userId: "u1",
      eventType: "mission_completed",
      source: "mission",
      sourceKey: "mission:m1:completed:t1",
      missionInstanceId: "m1",
      readinessBefore: "amber",
      readinessAfter: "amber",
      metadata: { user_id: "attacker", harmless: true },
      occurredAt: "2026-08-29T08:00:00.000Z",
    });

    expect(inserted).toMatchObject({ user_id: "u1", source_key: "mission:m1:completed:t1" });
    expect(inserted).not.toHaveProperty("harmless");
    expect(result.id).toBe("o1");
  });

  it("does not expose historical mutation helpers", () => {
    expect(repository).not.toHaveProperty("updateJourneyOutcome");
    expect(repository).not.toHaveProperty("deleteJourneyOutcome");
  });
});

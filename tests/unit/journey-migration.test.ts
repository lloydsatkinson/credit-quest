import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/009_journey_foundation.sql");

describe("V2.2A Journey migration", () => {
  it("creates owner-readable, server-written, idempotent Journey state and history", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create table public.journey_state");
    expect(sql).toContain("create table public.journey_outcomes");
    expect(sql).toContain("journey_state_select_own");
    expect(sql).toContain("journey_outcomes_select_own");
    expect(sql).toContain("unique (user_id, source_key)");
    expect(sql).toContain("journey_state_mission_owner_fkey");
    expect(sql).toContain("journey_outcomes_mission_owner_fkey");
    expect(sql).toContain("reject_journey_outcome_update");
    expect(sql).toContain("revoke insert, update, delete on public.journey_state from authenticated");
    expect(sql).toContain("revoke insert, update, delete on public.journey_outcomes from authenticated");
  });
});

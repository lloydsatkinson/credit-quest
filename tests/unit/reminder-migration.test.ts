import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/010_retention_runtime_flags.sql");

describe("V2.2B reminder migration", () => {
  it("creates private reminder state with default-off runtime switches", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create table public.journey_reminders");
    expect(sql).toContain("create table public.communication_preferences");
    expect(sql).toContain("create table public.feature_flags");
    expect(sql).toContain("'email_reminders_enabled', false");
    expect(sql).toContain("'commercial_gateway_enabled', false");
    expect(sql).toContain("'processing'");
    expect(sql).toContain("unique (user_id, channel, reason, source_key)");
    expect(sql).toContain("create or replace function public.claim_due_journey_reminders");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("grant execute on function public.claim_due_journey_reminders(integer, timestamptz) to service_role");
  });
});

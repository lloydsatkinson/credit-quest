import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/011_commercial_admin.sql");

describe("V2.2C commercial/admin migration", () => {
  it("creates private commercial control tables and no live seed", () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const sql = readFileSync(migrationPath, "utf8");
    for (const table of [
      "admin_members",
      "commercial_partners",
      "commercial_routes",
      "commercial_disclosures",
      "referral_attempts",
      "revenue_events",
      "experiments",
      "admin_audit_log",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql).toContain("commercial_disclosures_one_published");
    expect(sql).toContain("reject_referral_attempt_update");
    expect(sql).toContain("reject_revenue_event_update");
    expect(sql).toContain("publish_commercial_disclosure");
    expect(sql).toContain("credit-quest-sandbox");
    expect(sql).not.toMatch(/insert[\s\S]*environment[^;]*'live'/i);
  });
});

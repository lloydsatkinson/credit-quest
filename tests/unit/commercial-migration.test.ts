import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const commercialMigrationPath = resolve(process.cwd(), "supabase/migrations/011_commercial_admin.sql");
const sandboxIsolationPath = resolve(process.cwd(), "supabase/migrations/012_commercial_sandbox_isolation.sql");

describe("commercial/admin migrations", () => {
  it("creates private commercial control tables and no live seed", () => {
    expect(existsSync(commercialMigrationPath)).toBe(true);
    if (!existsSync(commercialMigrationPath)) return;
    const sql = readFileSync(commercialMigrationPath, "utf8");
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

  it("seeds a dedicated sandbox flag off and expands only the audited flag allowlist", () => {
    expect(existsSync(sandboxIsolationPath)).toBe(true);
    if (!existsSync(sandboxIsolationPath)) return;
    const sql = readFileSync(sandboxIsolationPath, "utf8");
    expect(sql).toContain("'commercial_sandbox_enabled', false");
    expect(sql).toContain("'email_reminders_enabled','commercial_gateway_enabled','commercial_sandbox_enabled'");
    expect(sql).not.toMatch(/commercial_gateway_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/commercial_sandbox_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/environment[^;]*'live'/i);
  });
});

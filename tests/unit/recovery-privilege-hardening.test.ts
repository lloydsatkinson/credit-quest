import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/015_recovery_privilege_hardening.sql",
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  if (!existsSync(migrationPath)) return "";
  return readFileSync(migrationPath, "utf8");
}

describe("recovery privilege hardening migration", () => {
  it("makes private recovery configuration service-role-only", () => {
    const sql = migrationSql();
    for (const table of [
      "decline_partners",
      "decline_partner_credentials",
      "decline_intake_sessions",
      "return_contracts",
    ]) {
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
    }
  });

  it("makes owner-readable recovery tables SELECT-only for authenticated clients", () => {
    const sql = migrationSql();
    for (const table of [
      "decline_recovery_journeys",
      "support_needs",
      "return_attempts",
    ]) {
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant select on public.${table} to authenticated`);
    }

    expect(sql).not.toMatch(/grant\s+(insert|update|delete|truncate|references|trigger)/i);
  });
});

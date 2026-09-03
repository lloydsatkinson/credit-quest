import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/013_decline_recovery_foundation.sql",
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  if (!existsSync(migrationPath)) return "";
  return readFileSync(migrationPath, "utf8");
}

describe("decline recovery foundation migration", () => {
  it("creates the isolated recovery persistence model with RLS", () => {
    const sql = migrationSql();
    for (const table of [
      "decline_partners",
      "decline_partner_credentials",
      "decline_intake_sessions",
      "decline_recovery_journeys",
      "support_needs",
      "return_contracts",
      "return_attempts",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("stores opaque handoffs as hashes and enforces partner idempotency and replay keys", () => {
    const sql = migrationSql();
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).toContain("idempotency_key text not null");
    expect(sql).toContain("unique (partner_id, idempotency_key)");
    expect(sql).toContain("nonce text not null");
    expect(sql).toContain("unique (partner_id, nonce)");
    expect(sql).not.toMatch(/\bhandoff_token\s+text\b/i);
    expect(sql).not.toMatch(/\braw_token\b/i);
  });

  it("seeds inbound and return runtime switches OFF without touching existing dark defaults", () => {
    const sql = migrationSql();
    expect(sql).toContain("'partner_decline_intake_enabled', false");
    expect(sql).toContain("'return_to_origin_enabled', false");
    expect(sql).not.toMatch(/partner_decline_intake_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/return_to_origin_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/commercial_gateway_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/commercial_sandbox_enabled'\s*,\s*true/i);
    expect(sql).not.toMatch(/email_reminders_enabled'\s*,\s*true/i);
  });

  it("keeps environment and return destinations server-owned and fail closed", () => {
    const sql = migrationSql();
    expect(sql).toContain("environment in ('sandbox','live')");
    expect(sql).toContain("return_contract_destination_check");
    expect(sql).toMatch(/environment\s*=\s*'sandbox'[\s\S]*destination_url\s+like\s+'\/sandbox\/%'/i);
    expect(sql).toMatch(/environment\s*=\s*'live'[\s\S]*destination_url\s+like\s+'https:\/\/%'/i);
    expect(sql).toContain("enabled boolean not null default false");
  });

  it("allows customers to read only their recovery/support/return records while config stays private", () => {
    const sql = migrationSql();
    for (const ownedTable of [
      "decline_recovery_journeys",
      "support_needs",
      "return_attempts",
    ]) {
      expect(sql).toContain(`create policy "${ownedTable}_select_own" on public.${ownedTable}`);
      expect(sql).toContain(`grant select on public.${ownedTable} to authenticated`);
      expect(sql).toContain(`revoke insert, update, delete on public.${ownedTable} from authenticated`);
    }

    for (const privateTable of [
      "decline_partners",
      "decline_partner_credentials",
      "decline_intake_sessions",
      "return_contracts",
    ]) {
      expect(sql).toContain(`revoke all on public.${privateTable} from anon, authenticated`);
      expect(sql).toContain(`grant all on public.${privateTable} to service_role`);
    }
  });

  it("keeps partner economics and detailed medical data out of the recovery schema", () => {
    const sql = migrationSql();
    expect(sql).not.toMatch(/\bcommission(_pence|_minor)?\b/i);
    expect(sql).not.toMatch(/\bpayout\b/i);
    expect(sql).not.toMatch(/\bepc\b/i);
    expect(sql).not.toMatch(/\bmedical_diagnosis\b/i);
    expect(sql).not.toMatch(/\bhealth_diagnosis\b/i);
  });

  it("extends the audited feature-flag allowlist but preserves service-role-only mutation", () => {
    const sql = migrationSql();
    expect(sql).toContain("partner_decline_intake_enabled");
    expect(sql).toContain("return_to_origin_enabled");
    expect(sql).toContain("revoke all on function public.admin_set_feature_flag(uuid,text,boolean) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.admin_set_feature_flag(uuid,text,boolean) to service_role");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/016_partner_secret_vault.sql",
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  if (!existsSync(migrationPath)) return "";
  return readFileSync(migrationPath, "utf8");
}

describe("partner secret Vault migration", () => {
  it("exposes only a service-role RPC for resolving named Vault secrets", () => {
    const sql = migrationSql();

    expect(sql).toContain("create or replace function public.get_partner_secret_from_vault");
    expect(sql).toContain("security definer");
    expect(sql).toContain("vault.decrypted_secrets");
    expect(sql).toContain("revoke all on function public.get_partner_secret_from_vault(text) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.get_partner_secret_from_vault(text) to service_role");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete).*vault\.decrypted_secrets/i);
  });

  it("fails closed on unsafe names or unavailable/short secrets", () => {
    const sql = migrationSql();

    expect(sql).toContain("partner_secret_unavailable");
    expect(sql).toMatch(/p_secret_name\s*!~\s*'\^\[A-Za-z0-9/i);
    expect(sql).toContain("length(v_secret) < 32");
  });
});

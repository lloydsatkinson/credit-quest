import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("partner Vault secret migration", () => {
  it("installs Vault and exposes secret resolution only to service_role", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/016_partner_credential_vault.sql"),
      "utf8",
    );

    expect(sql).toMatch(/create extension if not exists supabase_vault/i);
    expect(sql).toMatch(/create or replace function public\.get_partner_credential_vault_secret/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/vault\.decrypted_secrets/i);
    expect(sql).toMatch(/revoke all on function public\.get_partner_credential_vault_secret\(text\) from public/i);
    expect(sql).toMatch(/revoke all on function public\.get_partner_credential_vault_secret\(text\) from anon/i);
    expect(sql).toMatch(/revoke all on function public\.get_partner_credential_vault_secret\(text\) from authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.get_partner_credential_vault_secret\(text\) to service_role/i);
  });
});

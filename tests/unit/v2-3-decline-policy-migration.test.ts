import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("V2.3 decline policy migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/017_v2_3_decline_policy.sql"),
    "utf8",
  );

  it("creates the governed versioned policy tables", () => {
    for (const table of [
      "canonical_decline_reasons",
      "partner_decline_mappings",
      "recovery_templates",
      "recovery_template_steps",
      "reassessment_rules",
      "alternative_route_policies",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }
  });

  it("stores controlled condition AST rather than executable expressions", () => {
    expect(sql).toContain("condition_schema_version integer not null default 1");
    expect(sql).toContain("condition_ast jsonb");
    expect(sql).not.toMatch(/execute\s+immediate/i);
  });

  it("makes published policy rows immutable", () => {
    expect(sql).toContain("reject_published_recovery_policy_mutation");
    expect(sql).toContain("old.lifecycle = 'published'");
    expect(sql).toContain("published_recovery_policy_is_immutable");
  });

  it("keeps policy tables service-role only", () => {
    expect(sql).toContain("revoke all on public.partner_decline_mappings from anon, authenticated");
    expect(sql).toContain("grant all on public.partner_decline_mappings to service_role");
    expect(sql).toContain("revoke all on public.alternative_route_policies from anon, authenticated");
    expect(sql).toContain("grant all on public.alternative_route_policies to service_role");
  });

  it("seeds the canonical table with every approved V2.3 reason family code", () => {
    for (const code of [
      "ACTIVE_DAS",
      "RETURNED_PAYMENT_RECENT",
      "RECURRING_ACCOUNT_SHORTFALL",
      "UNARRANGED_OVERDRAFT_FREQUENT",
      "BUREAU_ASSOCIATION_DATA_REVIEW",
      "RISK_SCORE_BELOW_CUTOFF",
      "INTERNAL_SCORE_BELOW_CUTOFF",
      "AFFORDABILITY_SCORE_BELOW_CUTOFF",
      "SCORE_DECLINE_UNEXPLAINED",
      "RESIDENCY_POLICY_NOT_MET",
      "PRODUCT_AGE_POLICY_NOT_MET",
    ]) {
      expect(sql, code).toContain(`('${code}'`);
    }
  });

  it("publishes through the existing admin trust boundary", () => {
    expect(sql).toContain("create or replace function public.admin_publish_recovery_policy_version");
    expect(sql).toContain("perform public.assert_credit_quest_admin(p_admin_user_id)");
  });
});

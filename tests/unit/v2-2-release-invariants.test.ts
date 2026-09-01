import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

describe("V2.2 release invariants", () => {
  it("keeps all downstream capabilities dark by default", () => {
    for (const migration of [
      "supabase/migrations/009_journey_foundation.sql",
      "supabase/migrations/010_retention_runtime_flags.sql",
      "supabase/migrations/011_commercial_admin.sql",
    ]) expect(existsSync(resolve(process.cwd(), migration))).toBe(true);

    const flags = read("supabase/migrations/010_retention_runtime_flags.sql");
    expect(flags).toContain("'email_reminders_enabled', false");
    expect(flags).toContain("'commercial_gateway_enabled', false");

    const env = read(".env.example");
    expect(env).toContain("live_credit_referrals_allowed=false");
  });

  it("keeps every existing CI quality gate", () => {
    const ci = read(".github/workflows/ci.yml");
    for (const command of [
      "npm audit --omit=dev --audit-level=high",
      "npm run lint",
      "npm test",
      "supabase db start",
      "supabase/tests/rls.sql",
      "supabase/tests/retention_rls.sql",
      "supabase/tests/commercial_rls.sql",
      "npm run test:e2e",
      "npm run build",
    ]) expect(ci).toContain(command);
  });

  it("documents the final V2.2 dark release and presentation-only experiments", () => {
    const readme = read("README.md");
    expect(readme).toContain("v2.2d — analytics & release hardening");
    expect(readme).toContain("commercial_route_order");
    expect(readme).toContain("journey_status_copy");
    expect(readme).toContain("journey_email_opt_in_copy");
    expect(readme).toContain("revenue is reporting only");
    expect(readme).toContain("email_reminders_enabled=false");
    expect(readme).toContain("commercial_gateway_enabled=false");
    expect(readme).toContain("live_credit_referrals_allowed=false");
  });

  it("keeps the complete V2.2 protected-table and service-RPC SQL gate", () => {
    const rls = [
      read("supabase/tests/rls.sql"),
      read("supabase/tests/retention_rls.sql"),
      read("supabase/tests/commercial_rls.sql"),
    ].join("\n");
    for (const required of [
      "journey_state",
      "journey_outcomes",
      "journey_reminders",
      "communication_preferences",
      "feature_flags",
      "commercial_partners",
      "commercial_routes",
      "commercial_disclosures",
      "referral_attempts",
      "revenue_events",
      "experiments",
      "admin_members",
      "admin_audit_log",
      "claim_due_journey_reminders",
      "admin_set_feature_flag",
      "publish_commercial_disclosure",
      "reminder duplicate unexpectedly succeeded",
      "referral update unexpectedly succeeded",
      "revenue update unexpectedly succeeded",
      "journey outcome update unexpectedly succeeded",
    ]) expect(rls).toContain(required);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

const coreStrategyFiles = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/quest-score.ts",
  "lib/domain/mission-engine.ts",
  "lib/academy/selector.ts",
] as const;

describe("V2.0d recovery release boundaries", () => {
  it("keeps recovery, partner, support and economics downstream of core strategy", () => {
    for (const file of coreStrategyFiles) {
      const source = read(file);
      for (const forbidden of [
        "@/lib/recovery",
        "partner-intake",
        "return-origin",
        "support-needs",
        "decline_partner",
        "return_contract",
        "recovery-analytics",
        "commission",
        "revenue",
        "epc",
      ]) {
        expect(source, `${file} must not depend on ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("keeps support preferences functional and unable to mutate strategy state", () => {
    const repository = read("lib/server/support-needs-repository.ts");
    for (const allowed of [
      "simpler_explanations",
      "larger_text",
      "fewer_steps",
      "more_time",
      "reduced_motion",
      "reminder_support",
      "human_support",
      "digital_support",
    ]) expect(repository).toContain(allowed);

    for (const forbidden of [
      "safe_mode",
      "readiness_snapshot",
      "diagnosis",
      "user_missions",
      "medical_condition",
      "health_condition",
    ]) expect(repository).not.toContain(forbidden);
  });

  it("keeps recovery storage dark-first, sandbox-first and hash-only for handoff tokens", () => {
    const migration = read("supabase/migrations/013_decline_recovery_foundation.sql");
    expect(migration).toContain("'partner_decline_intake_enabled', false");
    expect(migration).toContain("'return_to_origin_enabled', false");
    expect(migration).toContain("sandbox_enabled boolean not null default false");
    expect(migration).toContain("live_enabled boolean not null default false");
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).not.toContain("raw_token");
    expect(migration).not.toContain("commission");
    expect(migration).not.toContain("revenue");
    expect(migration).not.toContain("epc");

    const intake = read("lib/server/partner-intake-service.ts");
    expect(intake).toContain('environment: "sandbox"');
    expect(intake).toContain('createhash("sha256")');

    const returnGateway = read("lib/server/return-origin-gateway.ts");
    expect(returnGateway).toContain("liveallowed: false");
  });

  it("documents the V2.0d dark release and data-protection gate", () => {
    const compliancePath = resolve(process.cwd(), "docs/compliance/v2-0d-data-protection-gate.md");
    expect(existsSync(compliancePath)).toBe(true);

    const compliance = read("docs/compliance/v2-0d-data-protection-gate.md");
    for (const required of [
      "article 6",
      "article 9",
      "data protection act 2018",
      "dpia",
      "special category",
      "out of scope",
      "functional support",
    ]) expect(compliance).toContain(required);

    const readme = read("README.md");
    for (const required of [
      "v2.0d — closed-loop decline recovery",
      "partner decline context is not credit quest diagnosis",
      "partner_decline_intake_enabled=false",
      "return_to_origin_enabled=false",
      "live return-to-origin remains disabled",
      "support needs do not automatically trigger safe mode",
      "aggregate recovery analytics",
      "exactly seven cards",
      "013_decline_recovery_foundation.sql",
    ]) expect(readme).toContain(required);
  });
});

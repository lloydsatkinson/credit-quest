import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pilotSpecPath = resolve(root, "tests/e2e/v2-3-recovery-pilot.spec.ts");

describe("V2.3 pilot E2E release contract", () => {
  it("requires a dedicated synthetic pilot Playwright spec", () => {
    expect(existsSync(pilotSpecPath)).toBe(true);
  });

  it("covers the real recovery resolver, governed alternative gate and deterministic cohort", () => {
    const source = readFileSync(pilotSpecPath, "utf8");
    expect(source).toContain("buildSyntheticRecoveryPilotScenarios");
    expect(source).toContain("resolveRecoveryBarriers");
    expect(source).toContain("evaluateAlternativeRoutePolicy");
    expect(source).toContain("NEGATIVE_DISPOSABLE_INCOME");
    expect(source).toContain("UNMAPPED_PARTNER_CODE");
  });

  it("covers admin/simulator, multi-reason handoff, existing CQ experience and lender boundary preservation", () => {
    const source = readFileSync(pilotSpecPath, "utf8");
    for (const marker of [
      "requireAdminUser",
      "runRecoverySimulation",
      "declineReasonCodes",
      "Your Credit Passport",
      "Can I apply yet?",
      "Learn in 20 seconds",
      "requireLenderUser",
      "firstReadyToCheckAt",
    ]) expect(source).toContain(marker);
  });

  it("does not create a test-only customer approval or readiness path", () => {
    const source = readFileSync(pilotSpecPath, "utf8").toLowerCase();
    expect(source).not.toContain("pre-approved");
    expect(source).not.toContain("guaranteed approval");
    expect(source).not.toContain("setreadiness");
  });
});

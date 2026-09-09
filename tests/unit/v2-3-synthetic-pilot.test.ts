import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_PILOT_DISTRIBUTION,
  buildSyntheticRecoveryPilotScenarios,
} from "../../scripts/v2-3-synthetic-pilot";
import { getCanonicalDeclineReason } from "@/lib/recovery/decline-taxonomy";

const expectedDistribution = {
  recent_ccj: 9,
  active_insolvency: 9,
  cais_8_9: 9,
  early_delinquency: 9,
  recent_stl_search_velocity: 9,
  thin_no_hit: 9,
  data_integrity: 9,
  high_dsr: 9,
  negative_disposable_income: 9,
  product_limit_mismatch: 9,
  multi_decline: 10,
} as const;

describe("V2.3 deterministic synthetic 100-customer pilot", () => {
  it("creates exactly 100 visibly synthetic, unique and deterministic scenarios", () => {
    const first = buildSyntheticRecoveryPilotScenarios();
    const second = buildSyntheticRecoveryPilotScenarios();

    expect(first).toHaveLength(100);
    expect(second).toEqual(first);
    expect(new Set(first.map((scenario) => scenario.scenarioId)).size).toBe(100);
    expect(first.every((scenario) => scenario.synthetic === true)).toBe(true);
    expect(first.every((scenario) => scenario.pilotType === "synthetic")).toBe(true);
    expect(first.every((scenario) => scenario.originReference.startsWith("synthetic-v2-3-"))).toBe(true);
  });

  it("uses the approved deterministic category distribution", () => {
    expect(SYNTHETIC_PILOT_DISTRIBUTION).toEqual(expectedDistribution);
    const scenarios = buildSyntheticRecoveryPilotScenarios();
    const counts = Object.fromEntries(
      Object.keys(expectedDistribution).map((category) => [
        category,
        scenarios.filter((scenario) => scenario.category === category).length,
      ]),
    );
    expect(counts).toEqual(expectedDistribution);
  });

  it("uses only canonical decline reasons and never fabricates random outcomes", () => {
    const scenarios = buildSyntheticRecoveryPilotScenarios();
    for (const scenario of scenarios) {
      expect(scenario.reasonCodes.length).toBeGreaterThan(0);
      for (const reasonCode of scenario.reasonCodes) {
        expect(getCanonicalDeclineReason(reasonCode), reasonCode).not.toBeNull();
      }
      expect(scenario.transition.kind).toMatch(/^(evidence|time|blocked)$/);
      expect(scenario.transition.seedKey.length).toBeGreaterThan(0);
      expect(scenario.expected.primaryReasonCode.length).toBeGreaterThan(0);
      expect(scenario.expected.treatment.length).toBeGreaterThan(0);
      expect(scenario.expected.solveability.length).toBeGreaterThan(0);
    }
  });

  it("keeps structural insolvency blocked and never routes negative disposable income", () => {
    const scenarios = buildSyntheticRecoveryPilotScenarios();
    const insolvency = scenarios.filter((scenario) => scenario.category === "active_insolvency");
    const negativeDi = scenarios.filter((scenario) => scenario.category === "negative_disposable_income");

    expect(insolvency.every((scenario) => scenario.transition.kind === "blocked")).toBe(true);
    expect(insolvency.every((scenario) => scenario.expected.alternativeRoutePotential === false)).toBe(true);
    expect(negativeDi.every((scenario) => scenario.expected.alternativeRoutePotential === false)).toBe(true);
    expect(negativeDi.every((scenario) => scenario.reasonCodes.includes("NEGATIVE_DISPOSABLE_INCOME"))).toBe(true);
  });

  it("keeps product-fit scenarios as candidates only, still subject to Credit Quest readiness", () => {
    const scenarios = buildSyntheticRecoveryPilotScenarios();
    const productFit = scenarios.filter((scenario) => scenario.category === "product_limit_mismatch");

    expect(productFit).toHaveLength(9);
    expect(productFit.every((scenario) => scenario.expected.alternativeRoutePotential === true)).toBe(true);
    expect(productFit.every((scenario) => scenario.expected.requiresIndependentReadiness === true)).toBe(true);
    expect(productFit.every((scenario) => scenario.transition.kind === "evidence")).toBe(true);
  });

  it("includes genuinely multi-reason cases rather than relabelling single declines", () => {
    const multi = buildSyntheticRecoveryPilotScenarios().filter((scenario) => scenario.category === "multi_decline");
    expect(multi).toHaveLength(10);
    expect(multi.every((scenario) => scenario.reasonCodes.length >= 2)).toBe(true);
    expect(multi.some((scenario) => scenario.reasonCodes.includes("NEGATIVE_DISPOSABLE_INCOME"))).toBe(true);
    expect(multi.some((scenario) => scenario.reasonCodes.includes("CAIS_DUPLICATE"))).toBe(true);
    expect(multi.some((scenario) => scenario.reasonCodes.includes("THIN_FILE"))).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runRecoverySimulation,
  type RecoverySimulationPolicy,
} from "@/lib/server/recovery-simulator-service";

const partnerId = "00000000-0000-0000-0000-000000000001";

const policy: RecoverySimulationPolicy = {
  mappings: [
    { id: "map-aff", externalCode: "AFF", canonicalCode: "NEGATIVE_DISPOSABLE_INCOME", version: 2, parameters: {} },
    { id: "map-fit", externalCode: "FIT", canonicalCode: "PRODUCT_LIMIT_MISMATCH", version: 4, parameters: {} },
    { id: "map-thin", externalCode: "THIN", canonicalCode: "THIN_FILE", version: 1, parameters: { minimumMonths: 3 } },
    { id: "map-sec", externalCode: "SEC", canonicalCode: "FRAUD_SECURITY_DECISION", version: 1, parameters: {} },
  ],
  templates: [
    {
      id: "template-thin",
      canonicalCode: "THIN_FILE",
      version: 3,
      customerHeadline: "Build more evidence.",
      steps: [
        { id: "step-now", phase: "now", priority: 10, customerWording: "Check your current credit-file details." },
        { id: "step-next", phase: "next", priority: 20, customerWording: "Build consistent account history." },
        { id: "step-then", phase: "then", priority: 30, customerWording: "Wait for genuine evidence to mature." },
        { id: "step-later", phase: "later", priority: 40, customerWording: "Reassess when the evidence supports it." },
      ],
    },
  ],
  reassessmentRules: [
    {
      id: "rule-thin",
      canonicalCode: "THIN_FILE",
      version: 2,
      conditionAst: { op: "gte", fact: "monthsSinceDecline", parameter: "minimumMonths" },
    },
  ],
  alternativeRoutes: [
    {
      id: "route-fit",
      canonicalCode: "PRODUCT_LIMIT_MISMATCH",
      destinationProductKey: "lower-exposure-card",
      version: 5,
    },
  ],
};

function input(declineCodes: string[], facts: Record<string, string | number | boolean | null> = {}) {
  return {
    partnerId,
    productCategory: "credit_card" as const,
    declineCodes,
    facts,
    now: "2026-09-09T12:00:00.000Z",
  };
}

describe("V2.3 production-equivalent recovery simulator", () => {
  it("reuses the deterministic barrier precedence and suppresses product routing behind affordability", () => {
    const result = runRecoverySimulation(input(["FIT", "AFF"]), policy);

    expect(result.canonicalMappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalCode: "AFF", canonicalCode: "NEGATIVE_DISPOSABLE_INCOME", version: 2 }),
      expect.objectContaining({ externalCode: "FIT", canonicalCode: "PRODUCT_LIMIT_MISMATCH", version: 4 }),
    ]));
    expect(result.barrierResolution.primary?.code).toBe("NEGATIVE_DISPOSABLE_INCOME");
    expect(result.treatment).toBe("create_headroom");
    expect(result.alternativeRouteState).toBe("suppressed");
    expect(result.suppressionReason).toMatch(/affordability/i);
  });

  it("keeps unmapped lender codes unknown rather than inferring a cause", () => {
    const result = runRecoverySimulation(input(["LENDER_UNKNOWN_CODE"]), policy);

    expect(result.canonicalMappings[0]).toMatchObject({
      externalCode: "LENDER_UNKNOWN_CODE",
      canonicalCode: null,
      version: null,
    });
    expect(result.barrierResolution.primary).toMatchObject({
      canonicalCode: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
    });
    expect(result.treatment).toBe("needs_evidence");
  });

  it("keeps an unmapped lender code unknown even when its text matches a CQ canonical code", () => {
    const result = runRecoverySimulation(input(["THIN_FILE"]), policy);

    expect(result.canonicalMappings[0]).toMatchObject({
      externalCode: "THIN_FILE",
      canonicalCode: null,
      version: null,
    });
    expect(result.barrierResolution.primary).toMatchObject({
      canonicalCode: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
    });
    expect(result.treatment).toBe("needs_evidence");
  });

  it("uses the shared three-valued condition evaluator and groups configured steps by phase", () => {
    const unknown = runRecoverySimulation(input(["THIN"]), policy);
    expect(unknown.reassessment?.result).toBe("unknown");

    const readyByCondition = runRecoverySimulation(input(["THIN"], { monthsSinceDecline: 3 }), policy);
    expect(readyByCondition.reassessment?.result).toBe(true);
    expect(readyByCondition.steps.now.map((step) => step.id)).toEqual(["step-now"]);
    expect(readyByCondition.steps.next.map((step) => step.id)).toEqual(["step-next"]);
    expect(readyByCondition.steps.then.map((step) => step.id)).toEqual(["step-then"]);
    expect(readyByCondition.steps.later.map((step) => step.id)).toEqual(["step-later"]);
    expect(readyByCondition.policyVersions).toEqual(expect.objectContaining({
      mapping: [1],
      template: [3],
      reassessment: [2],
    }));
  });

  it("suppresses normal route simulation for restricted security decisions", () => {
    const result = runRecoverySimulation(input(["SEC"]), policy);
    expect(result.treatment).toBe("restricted");
    expect(result.originalRouteState).toBe("suppressed");
    expect(result.alternativeRouteState).toBe("suppressed");
    expect(result.suppressionReason).toMatch(/restricted/i);
  });

  it("calls the same barrier resolver and condition language used by production", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/server/recovery-simulator-service.ts"), "utf8");
    expect(source).toContain("resolveRecoveryBarriers");
    expect(source).toContain("evaluateCondition");
    expect(source).not.toMatch(/eval\(|new Function/);
  });
});

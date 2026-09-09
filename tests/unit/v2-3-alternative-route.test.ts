import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { evaluateAlternativeRoutePolicy } from "@/lib/recovery/alternative-route";
import { resolveRecoveryBarriers } from "@/lib/recovery/multi-barrier-resolver";
import { createReturnOriginGateway } from "@/lib/server/return-origin-gateway";

const now = new Date("2026-09-09T12:00:00.000Z");
const policy = {
  id: "route-policy-1",
  canonicalCode: "PRODUCT_LIMIT_MISMATCH",
  destinationProductKey: "credit-card-lower-exposure",
  returnContractId: "contract-alt",
  conditionResult: true as const,
  minimumWaitComplete: true,
};

function gateInput(reasonCodes: string[], overrides: Record<string, unknown> = {}) {
  return {
    policy,
    barrierResolution: resolveRecoveryBarriers({ reasonCodes }),
    ageMode: "adult" as const,
    safetyMode: "normal" as const,
    evidenceComplete: true,
    readinessState: "ready_to_check" as const,
    customerChoice: "continue" as const,
    contract: {
      id: "contract-alt",
      enabled: true,
      expiresAt: "2026-10-01T00:00:00.000Z",
    },
    now,
    ...overrides,
  };
}

describe("V2.3 governed alternative eligibility route", () => {
  it("permits a lower-exposure eligibility check only for a routeable product-fit reason after CQ gates pass", () => {
    expect(evaluateAlternativeRoutePolicy(gateInput(["PRODUCT_LIMIT_MISMATCH"]))).toEqual({
      permitted: true,
      policyId: "route-policy-1",
      destinationProductKey: "credit-card-lower-exposure",
    });
  });

  it.each([
    ["negative disposable income", ["PRODUCT_LIMIT_MISMATCH", "NEGATIVE_DISPOSABLE_INCOME"], /affordability/i],
    ["active IVA", ["PRODUCT_LIMIT_MISMATCH", "ACTIVE_IVA"], /structural/i],
    ["restricted security decision", ["PRODUCT_LIMIT_MISMATCH", "FRAUD_SECURITY_DECISION"], /restricted/i],
    ["unknown decline", ["PARTNER_CODE_NOT_MAPPED"], /routeable|unknown|policy/i],
  ])("suppresses %s instead of treating a lower exposure as a fix", (_label, reasons, expectedReason) => {
    const result = evaluateAlternativeRoutePolicy(gateInput(reasons));
    expect(result.permitted).toBe(false);
    if (!result.permitted) expect(result.reason).toMatch(expectedReason);
  });

  it.each([
    ["under 18", { ageMode: "education" }, /under_18/i],
    ["Safe Mode", { safetyMode: "safe_mode" }, /safe_mode/i],
    ["missing evidence", { evidenceComplete: false }, /missing_evidence/i],
    ["not ready", { readinessState: "not_ready" }, /readiness/i],
    ["customer declined", { customerChoice: "decline" }, /customer/i],
    ["disabled contract", { contract: { id: "contract-alt", enabled: false, expiresAt: "2026-10-01T00:00:00.000Z" } }, /contract/i],
    ["expired contract", { contract: { id: "contract-alt", enabled: true, expiresAt: "2026-09-09T11:59:59.000Z" } }, /expired/i],
    ["unknown condition", { policy: { ...policy, conditionResult: "unknown" } }, /condition/i],
    ["wait not complete", { policy: { ...policy, minimumWaitComplete: false } }, /wait/i],
  ])("fails closed for %s", (_label, overrides, expectedReason) => {
    const result = evaluateAlternativeRoutePolicy(gateInput(["PRODUCT_LIMIT_MISMATCH"], overrides));
    expect(result.permitted).toBe(false);
    if (!result.permitted) expect(result.reason).toMatch(expectedReason);
  });

  it("rejects a contract that is not the server-owned contract pinned by the policy", () => {
    const result = evaluateAlternativeRoutePolicy(gateInput(["PRODUCT_LIMIT_MISMATCH"], {
      contract: { id: "different-contract", enabled: true, expiresAt: "2026-10-01T00:00:00.000Z" },
    }));
    expect(result).toMatchObject({ permitted: false });
    if (!result.permitted) expect(result.reason).toMatch(/contract/i);
  });
});

const profile = {
  userId: "user-1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed" as const,
  incomeBand: "30_50k" as const,
  housingStatus: "rent" as const,
  electoralRoll: true,
  utilisationPct: 22,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

const journey = {
  id: "recovery-1",
  userId: "user-1",
  origin: "partner" as const,
  productCategory: "credit_card" as const,
  partnerId: "partner-1",
  returnContractId: "contract-original",
  originReference: "origin-ref-1",
  nextReassessmentAt: null,
};

const originalContract = {
  id: "contract-original",
  contractKey: "original-card",
  partnerId: "partner-1",
  partnerDisplayName: "Example Bank",
  partnerEnabled: true,
  partnerSandboxEnabled: true,
  partnerLiveEnabled: false,
  environment: "sandbox" as const,
  destinationUrl: "/sandbox/original-return",
  productCategory: "credit_card" as const,
  disclosureKey: "return-to-origin",
  disclosureVersion: 2,
  callbackPolicy: "none" as const,
  callbackUrl: null,
  enabled: true,
  expiresAt: "2026-10-01T00:00:00.000Z",
};

const alternativeContract = {
  ...originalContract,
  id: "contract-alt",
  contractKey: "lower-exposure-card",
  destinationUrl: "/sandbox/alternative-check",
};

const disclosure = {
  id: "disclosure-2",
  disclosureKey: "return-to-origin",
  version: 2,
  body: "Eligibility is checked by the lender; approval is not guaranteed.",
};

function readiness(state: "green" | "amber" | "red" = "green") {
  return { state, headline: state, reasons: [], avoid: [], actions: [], reassessAt: null, daysUntilReassessment: null };
}

function gatewayDeps(alternative = true) {
  return {
    getGuidance: vi.fn().mockResolvedValue({ profile, readiness: readiness("green") }),
    getRecoveryJourney: vi.fn().mockResolvedValue(journey),
    getReturnContract: vi.fn(async (id: string) => id === "contract-alt" ? alternativeContract : originalContract),
    getDisclosure: vi.fn().mockResolvedValue(disclosure),
    getAlternativeRouteContext: vi.fn().mockResolvedValue(alternative ? {
      policy,
      barrierResolution: resolveRecoveryBarriers({ reasonCodes: ["PRODUCT_LIMIT_MISMATCH"] }),
    } : null),
    isGatewayEnabled: vi.fn().mockResolvedValue(true),
    isSandboxPilot: vi.fn().mockResolvedValue(true),
    isSuppressionClear: vi.fn().mockResolvedValue(true),
    appendReturnAttempt: vi.fn().mockResolvedValue({ id: "attempt-1" }),
    liveAllowed: false,
  };
}

describe("alternative route integration stays behind the existing return gateway", () => {
  it("uses the server-resolved alternative contract and reports route type when the pure gate passes", async () => {
    const deps = gatewayDeps(true);
    const result = await createReturnOriginGateway(deps).createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "continue",
      now,
    });

    expect(result).toMatchObject({
      status: "redirect",
      routeType: "alternative",
      destinationUrl: "/sandbox/alternative-check",
      destinationProductKey: "credit-card-lower-exposure",
    });
    expect(deps.getReturnContract).toHaveBeenCalledWith("contract-alt");
    expect(deps.appendReturnAttempt).toHaveBeenCalledWith(expect.objectContaining({ routeType: "alternative" }));
  });

  it("reports the existing return as original when no alternative policy is pinned", async () => {
    const deps = gatewayDeps(false);
    const result = await createReturnOriginGateway(deps).createReturn({
      userId: "user-1",
      recoveryJourneyId: "recovery-1",
      customerChoice: "continue",
      now,
    });
    expect(result).toMatchObject({ status: "redirect", routeType: "original", destinationUrl: "/sandbox/original-return" });
    expect(deps.appendReturnAttempt).toHaveBeenCalledWith(expect.objectContaining({ routeType: "original" }));
  });

  it("keeps the browser request free of route policy, destination and readiness controls", async () => {
    const { returnToOriginSchema } = await import("@/app/api/recovery/return/route");
    const valid = {
      recoveryJourneyId: "a6d4e69a-73bf-4a02-b196-4117be8e8722",
      customerChoice: "continue",
    };
    expect(returnToOriginSchema.safeParse(valid).success).toBe(true);
    for (const extra of [
      { routePolicyId: "route-policy-1" },
      { destinationProductKey: "credit-card-lower-exposure" },
      { routeType: "alternative" },
      { destinationUrl: "/sandbox/alternative-check" },
      { readinessState: "ready_to_check" },
    ]) {
      expect(returnToOriginSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("uses safe customer copy for the alternative CTA", () => {
    const card = readFileSync(resolve(process.cwd(), "components/recovery/return-to-origin-card.tsx"), "utf8");
    expect(card).toMatch(/Check eligibility for another option/);
    expect(card).not.toMatch(/pre-approved|guaranteed|likely to pass|you qualify/i);
  });
});

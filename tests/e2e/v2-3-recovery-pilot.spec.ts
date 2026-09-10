import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { buildSyntheticRecoveryPilotScenarios } from "../../scripts/v2-3-synthetic-pilot";
import { evaluateAlternativeRoutePolicy } from "../../lib/recovery/alternative-route";
import { resolveRecoveryBarriers } from "../../lib/recovery/multi-barrier-resolver";

const root = process.cwd();
const now = new Date("2026-09-09T12:00:00.000Z");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

const alternativePolicy = {
  id: "route-policy-e2e",
  canonicalCode: "PRODUCT_LIMIT_MISMATCH",
  destinationProductKey: "credit-card-lower-exposure",
  returnContractId: "contract-alt",
  conditionResult: true as const,
  minimumWaitComplete: true,
};

function alternativeDecision(reasonCodes: string[]) {
  return evaluateAlternativeRoutePolicy({
    policy: alternativePolicy,
    barrierResolution: resolveRecoveryBarriers({ reasonCodes }),
    ageMode: "adult",
    safetyMode: "normal",
    evidenceComplete: true,
    readinessState: "ready_to_check",
    customerChoice: "continue",
    contract: {
      id: "contract-alt",
      enabled: true,
      expiresAt: "2026-10-01T00:00:00.000Z",
    },
    now,
  });
}

async function completeNormalOnboarding(page: Page) {
  await page.goto("/onboarding", { waitUntil: "networkidle" });
  await page.getByTestId("dob").fill("1990-01-01");
  await page.getByTestId("next").click();
  await page.getByLabel("Employment status").selectOption("employed");
  await page.getByLabel("Annual personal income band").selectOption("30_50k");
  await page.getByTestId("next").click();
  await page.getByLabel("Housing situation").selectOption("rent");
  await page.getByTestId("next").click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByTestId("next").click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByTestId("next").click();
  await page.getByLabel("Missed payments").fill("0");
  await page.getByTestId("next").click();
  await page.getByLabel("Hard applications").fill("0");
  await page.getByTestId("next").click();
  await page.getByTestId("finish").click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("synthetic V2.3 cohort uses production recovery precedence and never creates blocked false positives", async () => {
  const scenarios = buildSyntheticRecoveryPilotScenarios();
  expect(scenarios).toHaveLength(100);
  expect(scenarios.filter((scenario) => scenario.reasonCodes.length >= 2)).toHaveLength(10);

  for (const scenario of scenarios) {
    const resolution = resolveRecoveryBarriers({ reasonCodes: scenario.reasonCodes });
    expect(resolution.primary?.canonicalCode).toBe(scenario.expected.primaryReasonCode);
    expect(resolution.primary?.treatment).toBe(scenario.expected.treatment);
    expect(resolution.primary?.solveability).toBe(scenario.expected.solveability);
  }

  const negativeDisposableIncome = alternativeDecision([
    "PRODUCT_LIMIT_MISMATCH",
    "NEGATIVE_DISPOSABLE_INCOME",
  ]);
  expect(negativeDisposableIncome).toMatchObject({
    permitted: false,
    reason: "alternative_affordability_blocker",
  });

  const insolvency = alternativeDecision(["PRODUCT_LIMIT_MISMATCH", "ACTIVE_IVA"]);
  expect(insolvency).toMatchObject({
    permitted: false,
    reason: "alternative_structural_blocker",
  });

  const unknown = resolveRecoveryBarriers({ reasonCodes: ["UNMAPPED_PARTNER_CODE"] });
  expect(unknown.primary).toMatchObject({
    canonicalCode: null,
    treatment: "needs_evidence",
    solveability: "unknown_or_unmapped",
  });
  expect(alternativeDecision(["PRODUCT_LIMIT_MISMATCH", "UNMAPPED_PARTNER_CODE"])).toMatchObject({
    permitted: false,
    reason: "alternative_decline_not_routeable_or_unknown",
  });

  expect(alternativeDecision(["PRODUCT_LIMIT_MISMATCH"])).toMatchObject({
    permitted: true,
    policyId: "route-policy-e2e",
  });
});

test("pilot path is composed from governed admin, simulator, handoff and lender boundaries", async () => {
  const adminPolicies = source("app/admin/recovery/policies/page.tsx");
  const adminPublish = source("app/api/admin/recovery/policies/publish/route.ts");
  const simulator = source("lib/server/recovery-simulator-service.ts");
  const handoffSchema = source("lib/recovery/partner-intake-schema.ts");
  const dashboard = source("app/dashboard/page.tsx");
  const lenderAuth = source("lib/server/lender-auth.ts");
  const lenderAnalytics = source("lib/server/lender-analytics-repository.ts");

  expect(adminPolicies).toContain("requireAdminUser");
  expect(adminPublish).toContain("requireAdminUser");
  expect(simulator).toContain("runRecoverySimulation");
  expect(simulator).toContain("resolveRecoveryBarriers");
  expect(handoffSchema).toContain("declineReasonCodes");
  expect(dashboard).toContain("Your Credit Passport");
  expect(dashboard).toContain("Can I apply yet?");
  expect(dashboard).toContain("Learn in 20 seconds");
  expect(lenderAuth).toContain("requireLenderUser");
  expect(lenderAnalytics).toContain("firstReadyToCheckAt");
});

test("existing Credit Quest seven-card customer experience survives V2.3", async ({ page }) => {
  await completeNormalOnboarding(page);

  const feed = page.getByTestId("quest-feed");
  const cards = feed.locator("[data-quest-feed-card]");
  await expect(cards).toHaveCount(7);
  await expect(cards.nth(2)).toContainText("Your Credit Passport");
  await expect(cards.nth(3)).toContainText("Can I apply yet?");
  await expect(cards.nth(4)).toContainText("Learn in 20 seconds");
  await expect(page.getByRole("region", { name: "Your recovery plan" })).toHaveCount(0);
});

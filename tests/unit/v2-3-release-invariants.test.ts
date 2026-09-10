import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAlternativeRoutePolicy } from "@/lib/recovery/alternative-route";
import { resolveRecoveryBarriers } from "@/lib/recovery/multi-barrier-resolver";
import { aggregateLenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const lower = (path: string) => source(path).toLowerCase();

function productionTsFiles(directory: string): string[] {
  const absolute = resolve(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return productionTsFiles(relative);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

function countProductionDefinitions(needle: string): number {
  return ["lib/domain", "lib/recovery", "lib/server"]
    .flatMap(productionTsFiles)
    .reduce((count, path) => count + (source(path).includes(needle) ? 1 : 0), 0);
}

const now = new Date("2026-09-09T12:00:00.000Z");
const alternativePolicy = {
  id: "route-policy-release",
  canonicalCode: "PRODUCT_LIMIT_MISMATCH",
  destinationProductKey: "credit-card-lower-exposure",
  returnContractId: "contract-alt",
  conditionResult: true as const,
  minimumWaitComplete: true,
};

function alternativeInput(reasonCodes: string[]) {
  return {
    policy: alternativePolicy,
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
  };
}

describe("V2.3 release invariants", () => {
  it("keeps one authoritative readiness, Passport and mission-ranking engine", () => {
    expect(countProductionDefinitions("export function assessApplicationReadiness")).toBe(1);
    expect(countProductionDefinitions("export function buildCreditPassport")).toBe(1);
    expect(countProductionDefinitions("export function rankMissionInstances")).toBe(1);
  });

  it("keeps lender policy downstream of Credit Quest safety and mission ranking", () => {
    const orchestrator = source("lib/server/recovery-orchestrator.ts");
    expect(orchestrator).toContain("deps.getSafetyMode(guidance.profile)");
    expect(orchestrator).toContain("deps.getNextMission(input.userId, guidance.profile, now)");
    expect(orchestrator).not.toMatch(/getSafetyMode\([^\n]*(policy|snapshot)/i);
    expect(orchestrator).not.toMatch(/getNextMission\([^\n]*(policy|snapshot)/i);
  });

  it("keeps lender analytics aggregate-only at its public result boundary", () => {
    const analytics = source("lib/server/lender-analytics-repository.ts");
    const start = analytics.indexOf("export interface LenderPilotAnalytics {");
    const end = analytics.indexOf("export type LenderPilotAnalyticsResult", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const publicResultShape = analytics.slice(start, end).toLowerCase();
    for (const forbidden of [
      "userid",
      "user_id",
      "support_needs",
      "vulnerability",
      "income",
      "disposable",
      "dateofbirth",
      "date_of_birth",
    ]) expect(publicResultShape).not.toContain(forbidden);
  });

  it("does not expose lender cut-offs or thresholds in customer recovery copy", () => {
    for (const path of [
      "components/recovery/return-to-origin-card.tsx",
      "components/recovery/recovery-hero.tsx",
      "components/recovery/recovery-next-card.tsx",
      "lib/recovery/experience.ts",
    ]) {
      expect(lower(path)).not.toMatch(/\bcut-?off\b|\bthreshold\b/);
    }
  });

  it("keeps live, email, commercial, partner intake and return defaults dark", () => {
    const retention = lower("supabase/migrations/010_retention_runtime_flags.sql");
    const recovery = lower("supabase/migrations/013_decline_recovery_foundation.sql");
    const env = lower(".env.example");
    expect(retention).toContain("'email_reminders_enabled', false");
    expect(retention).toContain("'commercial_gateway_enabled', false");
    expect(recovery).toContain("'partner_decline_intake_enabled', false");
    expect(recovery).toContain("'return_to_origin_enabled', false");
    expect(env).toContain("live_credit_referrals_allowed=false");
  });

  it("keeps restricted fraud/security outside normal alternative recovery", () => {
    const result = evaluateAlternativeRoutePolicy(alternativeInput([
      "PRODUCT_LIMIT_MISMATCH",
      "FRAUD_SECURITY_DECISION",
    ]));
    expect(result).toMatchObject({ permitted: false, reason: "alternative_restricted_decision" });
  });

  it("never treats lower exposure as a solution to negative disposable income", () => {
    const result = evaluateAlternativeRoutePolicy(alternativeInput([
      "PRODUCT_LIMIT_MISMATCH",
      "NEGATIVE_DISPOSABLE_INCOME",
    ]));
    expect(result).toMatchObject({ permitted: false, reason: "alternative_affordability_blocker" });
  });

  it("keeps historical Ready-to-Check counts monotonic when current readiness later falls", () => {
    const analytics = aggregateLenderPilotAnalytics(
      { partnerId: "partner-1", pilotIds: ["pilot-1"] },
      {
        assignments: [{
          partnerId: "partner-1",
          pilotId: "pilot-1",
          journeyId: "journey-1",
          canonicalCodes: ["THIN_FILE"],
          handoffAt: "2026-09-01T09:00:00.000Z",
          activatedAt: "2026-09-01T09:05:00.000Z",
          journeyStartedAt: "2026-09-01T09:05:00.000Z",
          firstActionAt: "2026-09-01T10:00:00.000Z",
          firstReassessedAt: "2026-09-05T09:00:00.000Z",
          firstReadyToCheckAt: "2026-09-06T09:00:00.000Z",
          currentReadiness: "not_ready",
        }],
        returns: [],
        actionSourceAvailable: true,
      },
    );
    expect(analytics.totals.readyToCheck).toBe(1);
    expect(analytics.declineReasons).toEqual([
      expect.objectContaining({ canonicalCode: "THIN_FILE", ready: 1 }),
    ]);
  });

  it("cannot close V2.3 without the deterministic synthetic pilot runner", () => {
    expect(existsSync(resolve(root, "scripts/v2-3-synthetic-pilot.ts"))).toBe(true);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FunnelSummary } from "@/components/lender/funnel-summary";
import { DeclinePerformanceTable } from "@/components/lender/decline-performance-table";
import type { LenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";

const analytics: LenderPilotAnalytics = {
  totals: {
    handoffs: 100,
    activated: 82,
    startedRecovery: null,
    reassessed: 48,
    readyToCheck: 31,
    voluntaryReturns: 17,
  },
  rates: {
    activation: 0.82,
    action: null,
    recovery: 0.378,
    return: 0.2073,
    endToEndYield: 0.17,
  },
  medianTimeToFirstActionHours: null,
  medianTimeToReadyDays: 21.5,
  returnOutcomes: {
    originalProductReturns: 12,
    alternativeRouteChecks: 5,
  },
  declineReasons: [
    { canonicalCode: "DSR_HIGH", handoffs: 20, activated: 17, ready: 6, returned: 3 },
    { canonicalCode: "THIN_FILE", handoffs: 14, activated: 12, ready: 7, returned: 4 },
  ],
};

afterEach(cleanup);

function source(path: string): string {
  const fullPath = resolve(process.cwd(), path);
  expect(existsSync(fullPath)).toBe(true);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

describe("V2.3 read-only lender console", () => {
  it("shows the governed recovery funnel and unavailable values without approval language", () => {
    render(<FunnelSummary analytics={analytics} />);
    for (const label of [
      "Handoffs",
      "Activated",
      "Started Recovery",
      "Reassessed",
      "Ready to Check",
      "Voluntary Return",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(document.body.textContent ?? "").not.toMatch(/approval rate|reapproval|approval probability|pre-approved|likely to pass/i);
  });

  it("shows canonical decline families as aggregate performance only", () => {
    render(<DeclinePerformanceTable reasons={analytics.declineReasons} />);
    expect(screen.getByText("DSR_HIGH")).toBeTruthy();
    expect(screen.getByText("Affordability")).toBeTruthy();
    expect(screen.getByText("THIN_FILE")).toBeTruthy();
    expect(screen.getByText("File depth")).toBeTruthy();

    const output = document.body.textContent ?? "";
    expect(output).not.toMatch(/userId|email|income|balance|support need|vulnerab|health|diagnosis/i);
    expect(screen.queryByRole("button", { name: /edit|publish/i })).toBeNull();
  });

  it("requires lender authentication before every analytics page read", () => {
    for (const path of [
      "app/lender/page.tsx",
      "app/lender/declines/page.tsx",
      "app/lender/cohorts/page.tsx",
      "app/lender/returns/page.tsx",
    ]) {
      const text = source(path);
      const authIndex = text.indexOf("requireLenderUser(");
      const analyticsIndex = text.indexOf("getLenderPilotAnalytics(");
      expect(authIndex).toBeGreaterThanOrEqual(0);
      expect(analyticsIndex).toBeGreaterThan(authIndex);
      expect(text).not.toMatch(/requireAdminUser|publish|updateRecoveryPolicy|saveRecoveryPolicy/i);
    }
  });

  it("keeps lender navigation read-only and separates original from alternative return outcomes", () => {
    const layout = source("app/lender/layout.tsx");
    for (const label of ["Overview", "Decline Intelligence", "Cohorts", "Return Outcomes"]) {
      expect(layout).toContain(label);
    }
    expect(layout).not.toMatch(/Edit|Publish|Journey Builder|Simulator/);

    const returnsPage = source("app/lender/returns/page.tsx");
    expect(returnsPage).toMatch(/Original product/i);
    expect(returnsPage).toMatch(/Alternative eligibility/i);
    expect(returnsPage).not.toMatch(/approved|suitable|pre-approved|likely to pass/i);
  });

  it("labels synthetic pilot context and never creates lender mutation routes", () => {
    const layout = source("app/lender/layout.tsx");
    expect(layout).toMatch(/Synthetic|Sandbox/i);

    const lenderTree = [
      "app/lender/page.tsx",
      "app/lender/declines/page.tsx",
      "app/lender/cohorts/page.tsx",
      "app/lender/returns/page.tsx",
    ].map(source).join("\n");
    expect(lenderTree).not.toMatch(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/);
  });
});

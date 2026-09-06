import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "app/dashboard/page.tsx"),
  "utf8",
);

describe("recovery-aware dashboard contract", () => {
  it("preserves the finite seven-card Quest Feed", () => {
    expect(dashboardSource).toContain("FEED_CARD_TOTAL = 7");
  });

  it("uses the Recovery Experience projection instead of the old additive status panel", () => {
    expect(dashboardSource).toContain("RecoveryHero");
    expect(dashboardSource).toContain("buildRecoveryExperienceProjection");
    expect(dashboardSource).not.toContain("<RecoveryStatus");
  });

  it("keeps resumable and open recovery actions as separate reads", () => {
    expect(dashboardSource).toContain("listPendingActionAttempts");
    expect(dashboardSource).toContain("listOpenActionAttempts");
  });

  it("derives evidence and only checks partner return availability server-side", () => {
    expect(dashboardSource).toContain("buildRecoveryEvidence");
    expect(dashboardSource).toContain("getReturnOriginAvailability");
  });

  it("keeps the established normal-dashboard fallback for non-recovery users", () => {
    expect(dashboardSource).toContain("You’re up to date for now.");
  });

  it("adds a fail-closed recovery rendering path", () => {
    expect(dashboardSource).toContain("RecoveryFallback");
    expect(dashboardSource).toContain("RecoveryProgressCard");
    expect(dashboardSource).toContain("RecoveryNextCard");
    expect(dashboardSource).toContain("RecoveryEvidence");
  });

  it("shows the existing return surface only for an independently ready and server-available partner route", () => {
    expect(dashboardSource).toContain("ReturnToOriginCard");
    expect(dashboardSource).toContain('recoveryExperience.state === "ready_to_check"');
    expect(dashboardSource).toContain('recoveryExperience.returnState.status === "available"');
    expect(dashboardSource).toContain("recoveryJourneyId={recoveryExperience.recoveryJourneyId}");
    expect(dashboardSource).toContain("partnerDisplayName={recoveryExperience.returnState.partnerLabel}");
  });
});

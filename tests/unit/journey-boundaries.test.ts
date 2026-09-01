import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const coreFiles = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/quest-score.ts",
  "lib/domain/mission-engine.ts",
  "lib/academy/selector.ts",
];

describe("V2.2A dependency direction", () => {
  it("keeps Journey and commercial concepts out of core strategy", () => {
    for (const file of coreFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8").toLowerCase();
      for (const forbidden of [
        "@/lib/journey",
        "journey-repository",
        "journey-orchestrator",
        "@/lib/commercial",
        "revenue",
        "affiliate",
        "commission",
        "campaign",
      ]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("does not silently change the known revolving-credit-null readiness edge", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/domain/readiness.ts"), "utf8");
    expect(source).not.toContain("profile.hasRevolvingCredit === null");
  });

  it("keeps Journey status outside the finite seven-card feed", () => {
    const serverDashboard = readFileSync(resolve(process.cwd(), "app/dashboard/page.tsx"), "utf8");
    const demoDashboard = readFileSync(resolve(process.cwd(), "components/dashboard/dashboard-client.tsx"), "utf8");

    for (const source of [serverDashboard, demoDashboard]) {
      expect(source).toContain("const FEED_CARD_TOTAL = 7");
      expect(source).toContain("<JourneyStatusCard");
      expect(source.indexOf("<JourneyStatusCard")).toBeLessThan(source.indexOf("<QuestFeed>"));
    }
  });
});

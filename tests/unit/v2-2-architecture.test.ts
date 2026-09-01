import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

const core = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/quest-score.ts",
  "lib/domain/mission-engine.ts",
  "lib/academy/selector.ts",
];

describe("V2.2 architecture boundaries", () => {
  it("keeps downstream journey/commercial/analytics out of core strategy", () => {
    for (const path of core) {
      const text = source(path);
      for (const forbidden of [
        "@/lib/journey",
        "@/lib/reminders",
        "@/lib/commercial",
        "@/lib/experiments",
        "metrics-repository",
        "revenue",
        "affiliate",
        "commission",
        "campaign",
        "feature-flag",
      ]) {
        expect(text, `${path} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("keeps the Quest Feed finite at seven cards", () => {
    expect(source("app/dashboard/page.tsx")).toContain("feed_card_total = 7");
    expect(source("components/dashboard/dashboard-client.tsx")).toContain("feed_card_total = 7");
  });

  it("pins the known revolving-credit readiness edge without changing it in V2.2", () => {
    expect(source("lib/domain/readiness.ts")).toContain("profile.hasrevolvingcredit === false");
  });
});

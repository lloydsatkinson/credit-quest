import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Journey route hooks", () => {
  it("observes onboarding only after the profile write has succeeded", () => {
    const text = source("app/api/onboarding/route.ts");
    expect(text).toContain("observeJourneyEvent");
    expect(text.indexOf("if (error) throw error;")).toBeLessThan(text.indexOf("await observeJourneyEvent"));
  });

  it("observes legacy mission outcomes only after the mission write succeeds", () => {
    const text = source("app/api/missions/[slug]/route.ts");
    expect(text).toContain("observeJourneyEvent");
    expect(text.indexOf("if (missionWrite.error)")).toBeLessThan(text.indexOf("await observeJourneyEvent"));
  });

  it("observes Action Layer outcomes only after event persistence", () => {
    const text = source("app/api/actions/attempts/[id]/route.ts");
    expect(text).toContain("observeJourneyEvent");
    expect(text.indexOf("await recordServerEvent")).toBeLessThan(text.indexOf("await observeJourneyEvent"));
  });

  it("keeps every Journey observation best-effort", () => {
    for (const path of [
      "app/api/onboarding/route.ts",
      "app/api/missions/[slug]/route.ts",
      "app/api/actions/attempts/[id]/route.ts",
    ]) {
      const text = source(path);
      const observation = text.indexOf("await observeJourneyEvent");
      expect(observation).toBeGreaterThan(-1);
      const tryBefore = text.lastIndexOf("try {", observation);
      const catchAfter = text.indexOf("catch", observation);
      expect(tryBefore).toBeGreaterThan(-1);
      expect(catchAfter).toBeGreaterThan(observation);
    }
  });

  it("does not map dismiss to a Journey outcome", () => {
    const text = source("app/api/missions/[slug]/route.ts");
    expect(text).not.toContain('eventType: "mission_dismissed"');
  });
});

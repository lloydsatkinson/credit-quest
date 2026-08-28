import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();
}

describe("Academy architecture boundaries", () => {
  it("keeps commercial inputs out of the deterministic Academy selector", () => {
    const selector = source("lib/academy/selector.ts");
    for (const forbidden of [
      "offer-matcher",
      "affiliate",
      "commission",
      "provider payout",
      "campaign",
      "epc",
    ]) {
      expect(selector).not.toContain(forbidden);
    }
  });

  it("keeps core guidance engines independent of Academy", () => {
    for (const path of [
      "lib/domain/safety.ts",
      "lib/domain/diagnosis.ts",
      "lib/domain/passport.ts",
      "lib/domain/readiness.ts",
    ]) {
      expect(source(path)).not.toContain("lib/academy");
      expect(source(path)).not.toContain("@/lib/academy");
    }
  });
});

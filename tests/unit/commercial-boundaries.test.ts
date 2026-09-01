import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

const core = [
  "lib/domain/safety.ts",
  "lib/domain/diagnosis.ts",
  "lib/domain/passport.ts",
  "lib/domain/readiness.ts",
  "lib/domain/mission-engine.ts",
  "lib/domain/quest-score.ts",
  "lib/academy/selector.ts",
];

describe("commercial dependency direction", () => {
  it("keeps commercial/admin/revenue data out of strategy", () => {
    for (const file of core) {
      const source = read(file).toLowerCase();
      for (const forbidden of ["@/lib/commercial", "commercial-gateway", "revenue_events", "feature_flags", "admin-repository", "commission", "epc", "payout", "campaign"]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("keeps economics out of gate and ordering implementations", () => {
    for (const file of ["lib/commercial/gates.ts", "lib/commercial/ordering.ts"]) {
      const source = read(file).toLowerCase();
      for (const forbidden of ["commission", "epc", "payout", "revenue", "campaign"]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("pins production-dark defaults and removes configured affiliate bypasses", () => {
    expect(read(".env.example")).toContain("LIVE_CREDIT_REFERRALS_ALLOWED=false");
    expect(read("app/offers/page.tsx")).not.toContain("affiliateUrl");
    expect(read("app/dashboard/page.tsx")).not.toContain("affiliateUrl");
    expect(read("components/dashboard/dashboard-client.tsx")).not.toContain("href={offer.affiliateUrl}");
  });

  it("keeps the Quest Feed at exactly seven cards", () => {
    expect(read("app/dashboard/page.tsx")).toContain("const FEED_CARD_TOTAL = 7");
    expect(read("components/dashboard/dashboard-client.tsx")).toContain("const FEED_CARD_TOTAL = 7");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("commercial UI boundaries", () => {
  it("routes configured offers through the Commercial Gateway", () => {
    const page = source("app/offers/page.tsx");
    expect(page).toContain("listPermittedCommercialRoutes");
    expect(page).toContain("CommercialGatewayCard");
  });

  it("keeps legacy demo product surfaces internal and inert", () => {
    for (const path of [
      "components/offers/offer-card.tsx",
      "components/dashboard/dashboard-client.tsx",
    ]) {
      const text = source(path);
      expect(text).not.toMatch(/\.affiliateUrl|window\.location\.assign\(offer|href=\{offer\.affiliateUrl\}/);
    }

    expect(source("components/offers/offer-card.tsx")).toContain("Demo only — no application is sent.");
    expect(source("components/dashboard/dashboard-client.tsx")).toContain("Demo only — no application is sent.");
  });
});

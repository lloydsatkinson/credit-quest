import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("V2.3 alternative route UI wiring", () => {
  it("carries the server-selected route type through RecoveryReturnState", () => {
    const experience = source("lib/recovery/experience.ts");
    expect(experience).toMatch(/status:\s*"available"[\s\S]*routeType:\s*"original"\s*\|\s*"alternative"/);
  });

  it("maps availability routeType on the server and passes it to card 7", () => {
    const dashboard = source("app/dashboard/page.tsx");
    expect(dashboard).toMatch(/routeType:\s*availability\.routeType\s*\?\?\s*"original"/);
    expect(dashboard).toMatch(/<ReturnToOriginCard[\s\S]*routeType=\{recoveryExperience\.returnState\.routeType\}/);
  });

  it("does not derive the customer route from alternativeRoutePotential", () => {
    const dashboard = source("app/dashboard/page.tsx");
    const cardSection = dashboard.match(/<ReturnToOriginCard[\s\S]*?\/>/)?.[0] ?? "";
    expect(cardSection).not.toMatch(/alternativeRoutePotential/);
  });
});

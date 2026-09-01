import { describe, expect, it } from "vitest";
import { orderEquivalentCommercialRoutes } from "@/lib/commercial/ordering";

describe("commercial route ordering", () => {
  it("uses stable route/partner keys and ignores economics-shaped extra data", () => {
    const routes = [
      { id: "2", routeKey: "z-route", partnerKey: "a", commission: 9999, epc: 9999 },
      { id: "1", routeKey: "a-route", partnerKey: "z", commission: 1, epc: 1 },
    ];

    const ordered = orderEquivalentCommercialRoutes(routes);

    expect(ordered.map((route) => route.id)).toEqual(["1", "2"]);
  });
});

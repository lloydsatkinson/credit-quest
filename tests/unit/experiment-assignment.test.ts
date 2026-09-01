import { describe, expect, it } from "vitest";
import {
  applyCommercialRoutePresentationVariant,
  assignExperimentVariant,
} from "@/lib/experiments/assignment";
import type { ActiveExperiment } from "@/lib/experiments/types";

const experiment: ActiveExperiment = {
  id: "e1",
  experimentKey: "route-order-v1",
  surface: "commercial_route_order",
  variants: [
    { key: "reverse", presentationKey: "reverse" },
    { key: "control", presentationKey: "control" },
  ],
};

describe("presentation experiment assignment", () => {
  it("is stable for the same user and experiment", () => {
    const first = assignExperimentVariant(experiment, "user-123");
    const second = assignExperimentVariant(experiment, "user-123");
    expect(second).toEqual(first);
  });

  it("preserves the exact permitted route set", () => {
    const routes = [
      { id: "r1", routeKey: "a", partnerKey: "a" },
      { id: "r2", routeKey: "b", partnerKey: "b" },
    ];
    const transformed = applyCommercialRoutePresentationVariant(routes, "reverse");
    expect(transformed.map((route) => route.id).sort()).toEqual(["r1", "r2"]);
    expect(transformed.map((route) => route.id)).toEqual(["r2", "r1"]);
  });

  it("falls back to unchanged order for an unknown variant", () => {
    const routes = [
      { id: "r1", routeKey: "a", partnerKey: "a" },
      { id: "r2", routeKey: "b", partnerKey: "b" },
    ];
    expect(applyCommercialRoutePresentationVariant(routes, "not-allowed")).toEqual(routes);
  });
});

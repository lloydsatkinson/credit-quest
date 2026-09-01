import { describe, expect, it, vi } from "vitest";
import { getActiveExperiment } from "@/lib/server/experiment-repository";

function fakeClient(row: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  return { from: vi.fn(() => chain) };
}

describe("active experiment repository", () => {
  it("returns only an active experiment with approved surface and variants", async () => {
    const row = {
      id: "e1",
      experiment_key: "route-order-v1",
      status: "active",
      surface_key: "commercial_route_order",
      variants: [
        { key: "control", presentationKey: "control" },
        { key: "reverse", presentationKey: "reverse" },
      ],
    };
    const result = await getActiveExperiment(fakeClient(row) as never, "commercial_route_order");
    expect(result?.experimentKey).toBe("route-order-v1");
    expect(result?.variants).toHaveLength(2);
  });

  it("returns null for an unapproved variant rather than guessing", async () => {
    const row = {
      id: "e1",
      experiment_key: "bad",
      status: "active",
      surface_key: "commercial_route_order",
      variants: [{ key: "paid-first", presentationKey: "paid-first" }],
    };
    await expect(getActiveExperiment(fakeClient(row) as never, "commercial_route_order")).resolves.toBeNull();
  });

  it("fails to control presentation when the read fails", async () => {
    await expect(getActiveExperiment(fakeClient(null, new Error("down")) as never, "commercial_route_order"))
      .resolves.toBeNull();
  });
});

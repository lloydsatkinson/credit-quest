import { describe, expect, it, vi } from "vitest";
import {
  listPublishedMappings,
  publishRecoveryPolicyVersion,
} from "@/lib/server/decline-policy-repository";

describe("V2.3 decline policy repository", () => {
  it("returns one active published mapping per external code", async () => {
    const rows = [
      {
        id: "m1",
        partner_id: "partner-1",
        product_category: "credit_card",
        external_code: "RISK_01",
        canonical_code: "CCJ_RECENT",
        parameters: { lookback_months: 24 },
        version: 7,
        lifecycle: "published",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
      },
    ];

    const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    const lifecycleEq = vi.fn(() => ({ in: inFn }));
    const productEq = vi.fn(() => ({ eq: lifecycleEq }));
    const partnerEq = vi.fn(() => ({ eq: productEq }));
    const select = vi.fn(() => ({ eq: partnerEq }));
    const client = { from: vi.fn(() => ({ select })) };

    const result = await listPublishedMappings(
      client as never,
      "partner-1",
      "credit_card",
      ["RISK_01"],
      new Date("2026-09-09T00:00:00.000Z"),
    );

    expect(result).toEqual({
      status: "ok",
      mappings: [expect.objectContaining({
        id: "m1",
        externalCode: "RISK_01",
        canonicalCode: "CCJ_RECENT",
        parameters: { lookback_months: 24 },
        version: 7,
        lifecycle: "published",
      })],
    });
  });

  it("fails closed when a requested code has no active published mapping", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const lifecycleEq = vi.fn(() => ({ in: inFn }));
    const productEq = vi.fn(() => ({ eq: lifecycleEq }));
    const partnerEq = vi.fn(() => ({ eq: productEq }));
    const select = vi.fn(() => ({ eq: partnerEq }));
    const client = { from: vi.fn(() => ({ select })) };

    const result = await listPublishedMappings(
      client as never,
      "partner-1",
      "credit_card",
      ["UNKNOWN"],
      new Date("2026-09-09T00:00:00.000Z"),
    );

    expect(result).toEqual({ status: "missing", externalCodes: ["UNKNOWN"] });
  });

  it("fails closed on ambiguous active published mappings", async () => {
    const rows = [
      {
        id: "m1",
        partner_id: "partner-1",
        product_category: "credit_card",
        external_code: "RISK_01",
        canonical_code: "CCJ_RECENT",
        parameters: {},
        version: 7,
        lifecycle: "published",
        effective_from: "2026-01-01T00:00:00.000Z",
        effective_to: null,
      },
      {
        id: "m2",
        partner_id: "partner-1",
        product_category: "credit_card",
        external_code: "RISK_01",
        canonical_code: "CCJ_RECENT",
        parameters: {},
        version: 8,
        lifecycle: "published",
        effective_from: "2026-06-01T00:00:00.000Z",
        effective_to: null,
      },
    ];

    const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    const lifecycleEq = vi.fn(() => ({ in: inFn }));
    const productEq = vi.fn(() => ({ eq: lifecycleEq }));
    const partnerEq = vi.fn(() => ({ eq: productEq }));
    const select = vi.fn(() => ({ eq: partnerEq }));
    const client = { from: vi.fn(() => ({ select })) };

    const result = await listPublishedMappings(
      client as never,
      "partner-1",
      "credit_card",
      ["RISK_01"],
      new Date("2026-09-09T00:00:00.000Z"),
    );

    expect(result).toEqual({ status: "ambiguous", externalCodes: ["RISK_01"] });
  });

  it("publishes through the admin RPC and never mutates a row directly", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { kind: "mapping", id: "draft-1" }, error: null });
    const client = { rpc };

    await publishRecoveryPolicyVersion(client as never, "admin-1", "draft-1");

    expect(rpc).toHaveBeenCalledWith("admin_publish_recovery_policy_version", {
      p_admin_user_id: "admin-1",
      p_draft_id: "draft-1",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  listAdminAudit,
  publishCommercialDisclosure,
  setFeatureFlag,
  upsertCommercialRoute,
} from "@/lib/server/admin-repository";

describe("admin repository", () => {
  it("sets only the allowlisted runtime flags through the audited RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    await setFeatureFlag({ rpc } as never, "admin-1", "commercial_gateway_enabled", false);
    expect(rpc).toHaveBeenCalledWith("admin_set_feature_flag", {
      p_admin_user_id: "admin-1",
      p_flag_key: "commercial_gateway_enabled",
      p_enabled: false,
    });

    await setFeatureFlag(
      { rpc } as never,
      "admin-1",
      "commercial_sandbox_enabled" as never,
      false,
    );
    expect(rpc).toHaveBeenCalledWith("admin_set_feature_flag", {
      p_admin_user_id: "admin-1",
      p_flag_key: "commercial_sandbox_enabled",
      p_enabled: false,
    });

    await expect(setFeatureFlag({ rpc } as never, "admin-1", "readiness_threshold" as never, true))
      .rejects.toThrow("Feature flag is not admin-editable");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("keeps commercial route safety requirements server-owned", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "route-1", error: null });
    const input = {
      routeId: null,
      routeKey: "sandbox-route",
      partnerId: "partner-1",
      environment: "sandbox" as const,
      destinationUrl: "/sandbox/referral-complete",
      enabled: false,
      disclosureKey: "sandbox-referral-disclosure",
    };

    await upsertCommercialRoute({ rpc } as never, "admin-1", input);
    expect(rpc).toHaveBeenCalledWith("admin_upsert_commercial_route", {
      p_admin_user_id: "admin-1",
      p_route_id: null,
      p_route_key: "sandbox-route",
      p_partner_id: "partner-1",
      p_environment: "sandbox",
      p_destination_url: "/sandbox/referral-complete",
      p_enabled: false,
      p_disclosure_key: "sandbox-referral-disclosure",
    });
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toMatch(/minAge|requiredReadiness|min_age|required_readiness/);
  });

  it("publishes disclosures only through the audited admin wrapper RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "d1" }, error: null });
    await publishCommercialDisclosure({ rpc } as never, "admin-1", "d1");
    expect(rpc).toHaveBeenCalledWith("admin_publish_commercial_disclosure", {
      p_admin_user_id: "admin-1",
      p_disclosure_id: "d1",
    });
  });

  it("caps admin audit reads at 100", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    const client = { from: vi.fn(() => ({ select })) };

    await listAdminAudit(client as never, 500);
    expect(limit).toHaveBeenCalledWith(100);
  });
});

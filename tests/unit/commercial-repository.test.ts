import { describe, expect, it, vi } from "vitest";
import * as repository from "@/lib/server/commercial-repository";
import {
  appendReferralAttempt,
  getPublishedCommercialDisclosure,
  listCommercialRoutes,
} from "@/lib/server/commercial-repository";

describe("commercial repository", () => {
  it("maps private route configuration and filters the exact environment", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{
        id: "route-1",
        route_key: "route-a",
        partner_id: "partner-1",
        environment: "sandbox",
        destination_url: "/sandbox/referral-complete",
        enabled: true,
        disclosure_key: "disc-a",
        commercial_partners: {
          partner_key: "partner-a",
          display_name: "Partner A",
          enabled: true,
          sandbox_enabled: true,
          live_enabled: false,
        },
      }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const routes = await listCommercialRoutes(client as never, "sandbox");

    expect(eq).toHaveBeenCalledWith("environment", "sandbox");
    expect(routes).toEqual([expect.objectContaining({
      id: "route-1",
      routeKey: "route-a",
      partnerId: "partner-1",
      partnerKey: "partner-a",
      partnerDisplayName: "Partner A",
      environment: "sandbox",
      destinationUrl: "/sandbox/referral-complete",
      enabled: true,
      disclosureKey: "disc-a",
      partnerEnabled: true,
      partnerSandboxEnabled: true,
      partnerLiveEnabled: false,
    })]);
  });

  it("maps only the currently published disclosure", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "disc-1",
        disclosure_key: "disc-a",
        version: 2,
        body: "Sandbox only.",
      },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const statusEq = vi.fn(() => ({ order }));
    const keyEq = vi.fn(() => ({ eq: statusEq }));
    const select = vi.fn(() => ({ eq: keyEq }));
    const client = { from: vi.fn(() => ({ select })) };

    const disclosure = await getPublishedCommercialDisclosure(client as never, "disc-a");

    expect(keyEq).toHaveBeenCalledWith("disclosure_key", "disc-a");
    expect(statusEq).toHaveBeenCalledWith("status", "published");
    expect(disclosure).toEqual({
      id: "disc-1",
      disclosureKey: "disc-a",
      version: 2,
      body: "Sandbox only.",
    });
  });

  it("inserts referral provenance without accepting a destination URL", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "ref-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn((payload: Record<string, unknown>) => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };

    await appendReferralAttempt(client as never, {
      referralKey: "ref-key",
      userId: "u1",
      partnerId: "partner-1",
      routeId: "route-1",
      originatingMissionId: null,
      readinessSnapshot: "green",
      consentedAt: "2026-08-31T08:00:00.000Z",
      disclosureId: "disc-1",
      environment: "sandbox",
      metadata: {},
    });

    expect(insert).toHaveBeenCalledWith({
      referral_key: "ref-key",
      user_id: "u1",
      partner_id: "partner-1",
      route_id: "route-1",
      originating_mission_id: null,
      readiness_snapshot: "green",
      consented_at: "2026-08-31T08:00:00.000Z",
      disclosure_id: "disc-1",
      environment: "sandbox",
      metadata: {},
    });
    expect(JSON.stringify(insert.mock.calls[0][0])).not.toMatch(/destination|commission|payout|epc/i);
  });

  it("does not expose application update/delete helpers for append-only history", () => {
    const exports = repository as unknown as Record<string, unknown>;
    expect(exports.updateReferralAttempt).toBeUndefined();
    expect(exports.deleteReferralAttempt).toBeUndefined();
    expect(exports.updateRevenueEvent).toBeUndefined();
  });
});

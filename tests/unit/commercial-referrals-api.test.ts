import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createCommercialReferral: vi.fn(),
  getUser: vi.fn(),
}));

class MockCommercialGatewayError extends Error {}

vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.getSupabasePublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/server/commercial-gateway", () => ({
  createCommercialReferral: mocks.createCommercialReferral,
  CommercialGatewayError: MockCommercialGatewayError,
}));

import {
  POST,
  commercialReferralSchema,
} from "@/app/api/commercial/referrals/route";

function request(payload: unknown) {
  return new Request("https://credit-quest-app.vercel.app/api/commercial/referrals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const valid = {
  routeId: "00000000-0000-0000-0000-000000000001",
  disclosureId: "00000000-0000-0000-0000-000000000002",
  consent: true,
};

describe("commercial referral API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createCommercialReferral.mockResolvedValue({
      referralId: "ref-1",
      destinationUrl: "/sandbox/referral-complete",
    });
  });

  it("accepts only stable ids and explicit consent", () => {
    expect(commercialReferralSchema.safeParse(valid).success).toBe(true);
    expect(commercialReferralSchema.safeParse({ ...valid, destinationUrl: "https://example.com" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, userId: "other-user" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, readiness: "green" }).success).toBe(false);
    expect(commercialReferralSchema.safeParse({ ...valid, commission: 500 }).success).toBe(false);
  });

  it("uses authenticated ownership and never accepts a caller destination", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(mocks.createCommercialReferral).toHaveBeenCalledWith({
      userId: "user-1",
      routeId: valid.routeId,
      disclosureId: valid.disclosureId,
      consent: true,
      originatingMissionId: null,
      now: expect.any(Date),
    });
  });

  it("rejects a client-supplied destination before gateway execution", async () => {
    const response = await POST(request({ ...valid, destinationUrl: "https://example.com" }));
    expect(response.status).toBe(400);
    expect(mocks.createCommercialReferral).not.toHaveBeenCalled();
  });

  it("requires a signed-in configured account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request(valid));
    expect(response.status).toBe(401);
    expect(mocks.createCommercialReferral).not.toHaveBeenCalled();
  });
});

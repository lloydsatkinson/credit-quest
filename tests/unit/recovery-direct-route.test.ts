import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
  createDirectRecoveryJourney: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.getSupabasePublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.createAdminSupabaseClient }));
vi.mock("@/lib/server/recovery-repository", () => ({
  createDirectRecoveryJourney: mocks.createDirectRecoveryJourney,
}));

import {
  POST,
  directDeclineSchema,
} from "@/app/api/recovery/declines/route";

const validPayload = {
  productCategory: "credit_card",
  declinedAt: "2026-09-01T15:30:00.000Z",
  providerName: "Example Bank",
  declineReasonProvided: false,
  declineReasonCode: null,
  recentApplicationContext: "one",
};

function request(payload: unknown) {
  return new Request("https://credit-quest-app.vercel.app/api/recovery/declines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("direct decline recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.createDirectRecoveryJourney.mockResolvedValue({
      id: "recovery-1",
      origin: "direct",
      productCategory: "credit_card",
      declineReasonKnown: false,
      declineReasonCode: null,
      declineReasonSource: "unknown",
    });
  });

  it("accepts only the customer-entered direct-decline fields", () => {
    expect(directDeclineSchema.safeParse(validPayload).success).toBe(true);

    for (const forbidden of [
      { partnerId: "partner-1" },
      { environment: "live" },
      { returnUrl: "https://evil.example" },
      { userId: "someone-else" },
      { readinessState: "ready_to_check" },
      { safeMode: false },
    ]) {
      expect(directDeclineSchema.safeParse({ ...validPayload, ...forbidden }).success).toBe(false);
    }
  });

  it("rejects invalid categories, invalid dates and an asserted reason without a reason value", () => {
    expect(directDeclineSchema.safeParse({ ...validPayload, productCategory: "crypto" }).success).toBe(false);
    expect(directDeclineSchema.safeParse({ ...validPayload, declinedAt: "yesterday" }).success).toBe(false);
    expect(directDeclineSchema.safeParse({
      ...validPayload,
      declineReasonProvided: true,
      declineReasonCode: null,
    }).success).toBe(false);
  });

  it("requires authentication before any persisted write", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request(validPayload));

    expect(response.status).toBe(401);
    expect(mocks.createDirectRecoveryJourney).not.toHaveBeenCalled();
  });

  it("derives ownership server-side and keeps an unprovided reason unknown", async () => {
    const response = await POST(request({
      ...validPayload,
      declineReasonCode: "THIS_MUST_NOT_BECOME_A_REASON",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createDirectRecoveryJourney).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      expect.objectContaining({
        origin: "direct",
        productCategory: "credit_card",
        reason: { known: false, code: null, source: "unknown" },
      }),
      "one",
      expect.any(Date),
    );
  });

  it("attributes a genuinely customer-provided reason to the customer, never a lender diagnosis", async () => {
    const response = await POST(request({
      ...validPayload,
      declineReasonProvided: true,
      declineReasonCode: "provider_said_affordability",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createDirectRecoveryJourney).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      expect.objectContaining({
        reason: {
          known: true,
          code: "provider_said_affordability",
          source: "customer",
        },
      }),
      "one",
      expect.any(Date),
    );
  });

  it("keeps demo-mode submission local and unpersisted", async () => {
    mocks.getSupabasePublicEnv.mockReturnValue(null);
    const response = await POST(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: "demo", persisted: false });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});

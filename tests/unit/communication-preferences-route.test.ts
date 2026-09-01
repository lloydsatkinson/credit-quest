import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
  getCommunicationPreference: vi.fn(),
  setJourneyEmailPreference: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.getSupabasePublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.createAdminSupabaseClient }));
vi.mock("@/lib/server/reminder-repository", () => ({
  getCommunicationPreference: mocks.getCommunicationPreference,
  setJourneyEmailPreference: mocks.setJourneyEmailPreference,
}));

import {
  GET,
  PATCH,
  journeyEmailPreferenceSchema,
} from "@/app/api/communication-preferences/route";

function request(payload: unknown) {
  return new Request("https://credit-quest-app.vercel.app/api/communication-preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("journey communication preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.getCommunicationPreference.mockResolvedValue({ journeyEmailEnabled: false });
    mocks.setJourneyEmailPreference.mockResolvedValue({ journeyEmailEnabled: true });
  });

  it("accepts only the journey service-email boolean", () => {
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true }).success).toBe(true);
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true, marketingConsent: true }).success).toBe(false);
    expect(journeyEmailPreferenceSchema.safeParse({ journeyEmailEnabled: true, userId: "someone-else" }).success).toBe(false);
  });

  it("rejects client-supplied ownership fields without writing", async () => {
    const response = await PATCH(request({ journeyEmailEnabled: true, userId: "someone-else" }));
    expect(response.status).toBe(400);
    expect(mocks.setJourneyEmailPreference).not.toHaveBeenCalled();
  });

  it("writes only for the authenticated user", async () => {
    const response = await PATCH(request({ journeyEmailEnabled: true }));
    expect(response.status).toBe(200);
    expect(mocks.setJourneyEmailPreference).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      true,
      expect.any(Date),
    );
  });

  it("fails GET closed when no preference has been persisted", async () => {
    mocks.getCommunicationPreference.mockRejectedValue(new Error("down"));
    const response = await GET();
    expect(await response.json()).toMatchObject({ journeyEmailEnabled: false, persisted: false });
  });

  it("keeps demo changes local and marks them unpersisted", async () => {
    mocks.getSupabasePublicEnv.mockReturnValue(null);
    const response = await PATCH(request({ journeyEmailEnabled: true }));
    expect(await response.json()).toMatchObject({ mode: "demo", journeyEmailEnabled: true, persisted: false });
    expect(mocks.createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});

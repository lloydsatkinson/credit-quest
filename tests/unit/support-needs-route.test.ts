import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
  listSupportNeeds: vi.fn(),
  replaceSupportNeeds: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.getSupabasePublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.createAdminSupabaseClient }));
vi.mock("@/lib/server/support-needs-repository", () => ({
  listSupportNeeds: mocks.listSupportNeeds,
  replaceSupportNeeds: mocks.replaceSupportNeeds,
}));

import { GET, PATCH, supportNeedsSchema } from "@/app/api/support-needs/route";

const validNeeds = ["simpler_explanations", "larger_text"];

function request(payload: unknown) {
  return new Request("https://credit-quest-app.vercel.app/api/support-needs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("support needs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, kind: "owner" });
    mocks.createAdminSupabaseClient.mockReturnValue({ kind: "admin" });
    mocks.listSupportNeeds.mockResolvedValue(validNeeds);
    mocks.replaceSupportNeeds.mockResolvedValue(validNeeds);
  });

  it("accepts only allowlisted functional support codes", () => {
    expect(supportNeedsSchema.safeParse({ needs: validNeeds }).success).toBe(true);
    expect(supportNeedsSchema.safeParse({ needs: [] }).success).toBe(true);

    for (const forbidden of [
      { diagnosis: "anxiety" },
      { medicalCondition: "anything" },
      { freeText: "private explanation" },
      { userId: "someone-else" },
      { safeMode: true },
    ]) {
      expect(supportNeedsSchema.safeParse({ needs: validNeeds, ...forbidden }).success).toBe(false);
    }

    expect(supportNeedsSchema.safeParse({ needs: ["not_a_support_code"] }).success).toBe(false);
    expect(supportNeedsSchema.safeParse({ needs: ["larger_text", "larger_text"] }).success).toBe(false);
  });

  it("requires authentication before reading persisted support needs", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.listSupportNeeds).not.toHaveBeenCalled();
  });

  it("reads support needs only for the authenticated owner", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listSupportNeeds).toHaveBeenCalledWith(expect.objectContaining({ kind: "owner" }), "user-1");
    expect(body).toMatchObject({
      persisted: true,
      needs: validNeeds,
      adaptations: {
        simplerExplanations: true,
        largerText: true,
      },
    });
  });

  it("replaces support needs for the authenticated owner without touching Safe Mode", async () => {
    const response = await PATCH(request({ needs: ["more_time", "human_support"] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.replaceSupportNeeds).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      ["more_time", "human_support"],
      expect.any(Date),
    );
    expect(JSON.stringify(mocks.replaceSupportNeeds.mock.calls)).not.toContain("safeMode");
    expect(body.adaptations).toMatchObject({
      moreTime: true,
      humanSupport: true,
      consequentialActionConfirmation: true,
    });
  });

  it("allows the customer to clear all support preferences", async () => {
    mocks.replaceSupportNeeds.mockResolvedValue([]);
    const response = await PATCH(request({ needs: [] }));

    expect(response.status).toBe(200);
    expect(mocks.replaceSupportNeeds).toHaveBeenCalledWith(
      { kind: "admin" },
      "user-1",
      [],
      expect.any(Date),
    );
  });

  it("keeps demo support choices local and unpersisted", async () => {
    mocks.getSupabasePublicEnv.mockReturnValue(null);

    const getResponse = await GET();
    expect(await getResponse.json()).toMatchObject({ mode: "demo", persisted: false, needs: [] });

    const patchResponse = await PATCH(request({ needs: ["reduced_motion"] }));
    expect(await patchResponse.json()).toMatchObject({
      mode: "demo",
      persisted: false,
      needs: ["reduced_motion"],
      adaptations: { reducedMotion: true },
    });
    expect(mocks.createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});

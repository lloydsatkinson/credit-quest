import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabasePublicEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  listPermittedCommercialRoutes: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({ getSupabasePublicEnv: mocks.getSupabasePublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/server/commercial-gateway", () => ({
  listPermittedCommercialRoutes: mocks.listPermittedCommercialRoutes,
}));

import { GET } from "@/app/api/commercial/routes/route";

describe("commercial route listing API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabasePublicEnv.mockReturnValue({ url: "https://example.supabase.co", anonKey: "anon" });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.listPermittedCommercialRoutes.mockResolvedValue([]);
  });

  it("keeps unconfigured demo mode inert", async () => {
    mocks.getSupabasePublicEnv.mockReturnValue(null);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ routes: [], mode: "demo" });
    expect(mocks.listPermittedCommercialRoutes).not.toHaveBeenCalled();
  });

  it("uses only the authenticated user and sandbox environment", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.listPermittedCommercialRoutes).toHaveBeenCalledWith({
      userId: "user-1",
      environment: "sandbox",
      now: expect.any(Date),
    });
  });

  it("requires authentication in configured mode", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.listPermittedCommercialRoutes).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("exchanges the PKCE code on the server and redirects to onboarding", async () => {
    const request = new Request(
      "https://credit-quest-app.vercel.app/auth/callback?code=magic-code&next=%2Fonboarding",
    );

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("magic-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://credit-quest-app.vercel.app/onboarding",
    );
  });

  it("does not allow an external next URL", async () => {
    const request = new Request(
      "https://credit-quest-app.vercel.app/auth/callback?code=magic-code&next=https%3A%2F%2Fevil.example",
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://credit-quest-app.vercel.app/onboarding",
    );
  });

  it("returns to login when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const request = new Request(
      "https://credit-quest-app.vercel.app/auth/callback?code=bad-code&next=%2Fonboarding",
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://credit-quest-app.vercel.app/login?auth_error=callback_failed",
    );
  });
});

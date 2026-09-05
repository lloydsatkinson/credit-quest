import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/confirm/route";

const verifyOtp = vi.fn();
const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const HANDOFF_PATH = `/recovery/handoff/${"A".repeat(43)}`;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { verifyOtp },
  }),
}));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies only a magic-link token hash and redirects to the secure handoff", async () => {
    const request = new Request(
      `${SITE_ORIGIN}/auth/confirm?token_hash=pilot-token-hash&type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
    );

    const response = await GET(request);

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "pilot-token-hash",
      type: "magiclink",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${SITE_ORIGIN}${HANDOFF_PATH}`);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects missing tokens, other OTP types and non-handoff destinations before verification", async () => {
    const missing = await GET(new Request(
      `${SITE_ORIGIN}/auth/confirm?type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
    ));
    expect(missing.headers.get("location")).toBe(
      `${SITE_ORIGIN}/login?auth_error=callback_failed`,
    );

    const wrongType = await GET(new Request(
      `${SITE_ORIGIN}/auth/confirm?token_hash=pilot-token-hash&type=recovery&next=${encodeURIComponent(HANDOFF_PATH)}`,
    ));
    expect(wrongType.headers.get("location")).toBe(
      `${SITE_ORIGIN}/login?auth_error=callback_failed`,
    );

    const wrongPath = await GET(new Request(
      `${SITE_ORIGIN}/auth/confirm?token_hash=pilot-token-hash&type=magiclink&next=%2Fadmin`,
    ));
    expect(wrongPath.headers.get("location")).toBe(
      `${SITE_ORIGIN}/login?auth_error=callback_failed`,
    );

    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("returns to login without the token when Supabase verification fails", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("invalid token") });
    const request = new Request(
      `${SITE_ORIGIN}/auth/confirm?token_hash=secret-token-hash&type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      `${SITE_ORIGIN}/login?auth_error=callback_failed`,
    );
    expect(response.headers.get("location")).not.toContain("secret-token-hash");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

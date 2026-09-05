import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/confirm/route";

const PILOT_USER_ID = "ca79d264-e2f1-4467-b655-eb7a66a289fa";
const PILOT_EMAIL = "cq-internal-pilot-3dbb2ff3@example.com";
const verifyOtp = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const HANDOFF_PATH = `/recovery/handoff/${"A".repeat(43)}`;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { verifyOtp, getUser, signOut },
  }),
}));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    getUser.mockReset();
    signOut.mockReset();
    verifyOtp.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: PILOT_USER_ID,
          email: PILOT_EMAIL,
          app_metadata: {
            credit_quest_internal_test: true,
            credit_quest_sandbox_pilot: true,
          },
        },
      },
      error: null,
    });
    signOut.mockResolvedValue({ error: null });
  });

  it("verifies only a magic-link token hash and redirects the exact synthetic pilot to the secure handoff", async () => {
    const request = new Request(
      `${SITE_ORIGIN}/auth/confirm?token_hash=pilot-token-hash&type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
    );

    const response = await GET(request);

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "pilot-token-hash",
      type: "magiclink",
    });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
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
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects non-canonical request origins before touching Supabase auth", async () => {
    const response = await GET(new Request(
      `https://evil.example/auth/confirm?token_hash=pilot-token-hash&type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
    ));

    expect(response.headers.get("location")).toBe(
      `${SITE_ORIGIN}/login?auth_error=callback_failed`,
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("signs out and rejects a valid OTP session that is not the exact synthetic internal pilot", async () => {
    for (const user of [
      {
        id: "00000000-0000-0000-0000-000000000000",
        email: PILOT_EMAIL,
        app_metadata: {
          credit_quest_internal_test: true,
          credit_quest_sandbox_pilot: true,
        },
      },
      {
        id: PILOT_USER_ID,
        email: "real-customer@gmail.com",
        app_metadata: {
          credit_quest_internal_test: true,
          credit_quest_sandbox_pilot: true,
        },
      },
      {
        id: PILOT_USER_ID,
        email: PILOT_EMAIL,
        app_metadata: { credit_quest_internal_test: true },
      },
    ]) {
      getUser.mockResolvedValueOnce({ data: { user }, error: null });

      const response = await GET(new Request(
        `${SITE_ORIGIN}/auth/confirm?token_hash=pilot-token-hash&type=magiclink&next=${encodeURIComponent(HANDOFF_PATH)}`,
      ));

      expect(response.headers.get("location")).toBe(
        `${SITE_ORIGIN}/login?auth_error=callback_failed`,
      );
    }

    expect(verifyOtp).toHaveBeenCalledTimes(3);
    expect(signOut).toHaveBeenCalledTimes(3);
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
    expect(getUser).not.toHaveBeenCalled();
  });
});

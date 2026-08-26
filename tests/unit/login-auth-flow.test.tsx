import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";

const signInWithOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signInWithOtp, exchangeCodeForSession },
  }),
}));

afterEach(() => cleanup());

describe("Login magic-link flow", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    exchangeCodeForSession.mockReset();
    replace.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    window.history.replaceState(null, "", "/login");
  });

  it("exchanges a returned magic-link code and continues to onboarding", async () => {
    window.history.replaceState(null, "", "/login?code=magic-code&next=%2Fonboarding");

    render(<LoginPage />);

    await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith("magic-code"));
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });
});

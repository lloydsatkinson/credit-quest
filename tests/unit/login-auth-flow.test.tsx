import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";

const signInWithOtp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signInWithOtp },
  }),
}));

afterEach(() => cleanup());

describe("Login magic-link flow", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it("routes magic links through an auth callback before onboarding", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));

    const call = signInWithOtp.mock.calls[0][0];
    expect(call.email).toBe("test@example.com");
    expect(call.options.emailRedirectTo).toContain("/auth/callback?next=%2Fonboarding");
  });
});

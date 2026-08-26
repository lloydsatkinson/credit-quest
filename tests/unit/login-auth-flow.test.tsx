import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

  it("sends magic links through the server auth callback", async () => {
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

  it("provides a server auth callback route", () => {
    expect(existsSync(resolve(process.cwd(), "app/auth/callback/route.ts"))).toBe(true);
  });
});

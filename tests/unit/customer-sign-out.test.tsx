import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "@/components/customer/sign-out-button";

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { signOut },
  }),
}));

afterEach(cleanup);

describe("customer sign out", () => {
  beforeEach(() => {
    signOut.mockReset();
    replace.mockReset();
    refresh.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it("signs out through Supabase and returns the customer to login", async () => {
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

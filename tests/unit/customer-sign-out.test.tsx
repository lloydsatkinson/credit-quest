import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignOutButton } from "@/components/customer/sign-out-button";

afterEach(cleanup);

describe("customer sign out", () => {
  it("posts logout to the server-side Supabase sign-out route", () => {
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: /log out/i });
    const form = button.closest("form");

    expect(form?.getAttribute("action")).toBe("/auth/signout");
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
  });

  it("clears the Supabase session server-side and returns the customer to login", () => {
    const routeSource = readFileSync("app/auth/signout/route.ts", "utf8");

    expect(routeSource).toContain("supabase.auth.signOut()");
    expect(routeSource).toContain('new URL("/login"');
  });

  it("makes logout available in the shared customer header and explicitly on Profile", () => {
    const shellSource = readFileSync("components/customer/customer-shell.tsx", "utf8");
    const profileSource = readFileSync("app/accounts/page.tsx", "utf8");

    expect(shellSource).toContain("SignOutButton");
    expect(profileSource).toContain("SignOutButton");
  });
});

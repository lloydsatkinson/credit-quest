import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("demo dashboard UI", () => {
  it("keeps the finite 7-card Quest Feed and uses premium shortcut chrome", () => {
    render(<DashboardClient />);

    const feed = screen.getByTestId("quest-feed");
    expect(feed.querySelectorAll("[data-quest-feed-card]")).toHaveLength(7);

    const shortcuts = screen.getByTestId("demo-dashboard-shortcuts");
    expect(shortcuts.className).toContain("cq-panel");
    expect(screen.queryByRole("link", { name: "Credit Quest" })).toBeNull();
    expect(screen.getByRole("link", { name: "Accounts" }).getAttribute("href")).toBe("/accounts");
    expect(screen.getByRole("link", { name: "Offers" }).getAttribute("href")).toBe("/offers");
  });
});

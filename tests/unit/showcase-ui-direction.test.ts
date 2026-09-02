import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const lower = (path: string) => read(path).toLowerCase();

describe("Credit Quest showcase UI direction", () => {
  it("provides a shared immersive customer shell with finite app navigation", () => {
    const shellPath = "components/customer/customer-shell.tsx";
    expect(existsSync(resolve(process.cwd(), shellPath))).toBe(true);

    const shell = lower(shellPath);
    expect(shell).toContain('data-testid="customer-shell"');
    expect(shell).toContain("cq-customer-shell");
    expect(shell).toContain("cq-bottom-nav");
    for (const route of ["/dashboard", "/passport", "/readiness", "/learn", "/accounts"]) {
      expect(shell).toContain(`href: \"${route}\"`);
    }
  });

  it("uses the showcase dark neon design tokens and preserves reduced-motion support", () => {
    const css = lower("app/globals.css");
    for (const token of [
      "--cq-bg: #05070d",
      "--cq-panel:",
      "--cq-cyan:",
      "--cq-lime:",
      "--cq-magenta:",
      ".cq-customer-shell",
      ".cq-bottom-nav",
      "prefers-reduced-motion",
    ]) expect(css).toContain(token);
  });

  it("keeps the Quest Feed finite while making it an immersive snap experience", () => {
    const feed = lower("components/dashboard/quest-feed.tsx");
    expect(feed).toContain("cq-quest-feed");
    expect(feed).toContain("cq-feed-card");
    expect(feed).toContain("snap-y snap-mandatory");
    expect(feed).toContain("finite feed");

    const dashboard = read("app/dashboard/page.tsx");
    expect(dashboard).toContain("FEED_CARD_TOTAL = 7");
    expect(dashboard).toContain("<CustomerShell");
    expect(dashboard).toContain("<PassportCard");
    expect(dashboard).toContain("<ReadinessCard");
  });

  it("applies the shared customer shell to the core customer journey", () => {
    for (const path of [
      "app/dashboard/page.tsx",
      "app/passport/page.tsx",
      "app/readiness/page.tsx",
      "app/learn/page.tsx",
      "app/onboarding/page.tsx",
      "app/sandbox/referral-complete/page.tsx",
    ]) {
      expect(read(path)).toContain("CustomerShell");
    }
  });
});

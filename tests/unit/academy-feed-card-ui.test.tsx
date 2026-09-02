import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcademyCard } from "@/components/academy/academy-card";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import type { AcademySelection } from "@/lib/academy/types";

vi.mock("@/components/academy/academy-tracker", () => ({
  AcademyCardTracker: () => null,
}));

const article = DEMO_ACADEMY_ARTICLES[0];
const selection: AcademySelection = {
  article,
  reasonType: "fallback",
  reasonKey: null,
  whyThisMatters: "A useful foundation for understanding your next steps in Credit Quest.",
};

afterEach(() => cleanup());

describe("Academy Quest Feed card", () => {
  it("uses the native premium palette while preserving the learning destination", () => {
    render(<AcademyCard selection={selection} />);

    const surface = screen.getByTestId("academy-feed-card");
    expect(surface.className).toContain("text-white");

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link.getAttribute("href")).toBe(`/learn/${article.slug}`);
    expect(link.className).toContain("bg-cyan-300");
    expect(link.className).not.toContain("bg-violet-700");
    expect(screen.getByText(selection.whyThisMatters, { exact: true })).not.toBeNull();
  });
});

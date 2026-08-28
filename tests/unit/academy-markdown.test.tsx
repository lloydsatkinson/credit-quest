import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcademyMarkdown } from "@/lib/academy/markdown";

describe("Academy Markdown", () => {
  it("renders the supported subset without executing or linking unsafe input", () => {
    render(
      <AcademyMarkdown
        markdown={"## Safe heading\n\n<script>alert(1)</script>\n\n[Bad](javascript:alert(1))\n\n[Good](https://www.gov.uk/register-to-vote)\n\n**Bold point** and *useful emphasis*"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Safe heading" })).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByText("Bad")).toBeVisible();
    expect(screen.getByRole("link", { name: "Good" })).toHaveAttribute(
      "href",
      "https://www.gov.uk/register-to-vote",
    );
    expect(screen.getByRole("link", { name: "Good" })).toHaveAttribute(
      "rel",
      expect.stringContaining("noreferrer"),
    );
    expect(screen.getByText("Bold point")).toBeVisible();
    expect(screen.getByText("useful emphasis")).toBeVisible();
  });
});

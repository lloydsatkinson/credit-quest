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

    expect(screen.getByRole("heading", { name: "Safe heading" })).not.toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("link", { name: "Bad" })).toBeNull();
    expect(screen.getByText("Bad")).not.toBeNull();

    const goodLink = screen.getByRole("link", { name: "Good" });
    expect(goodLink.getAttribute("href")).toBe("https://www.gov.uk/register-to-vote");
    expect(goodLink.getAttribute("rel")?.includes("noreferrer")).toBe(true);

    expect(screen.getByText("Bold point")).not.toBeNull();
    expect(screen.getByText("useful emphasis")).not.toBeNull();
  });
});

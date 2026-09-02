import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AcademyArticleView } from "@/components/academy/academy-article";
import { AcademyLibrary, AcademyUnavailable } from "@/components/academy/academy-library";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const article = DEMO_ACADEMY_ARTICLES[0];

afterEach(() => cleanup());

describe("customer UI consistency", () => {
  it("renders the Academy library as a premium Credit Quest surface", () => {
    render(<AcademyLibrary articles={[article]} query="" topic={null} />);

    const shell = screen.getByTestId("academy-library-shell");
    expect(shell.className).toContain("text-white");

    const search = screen.getByTestId("academy-search-panel");
    expect(search.className).toContain("cq-panel");

    const card = screen.getByTestId(`academy-card-${article.id}`);
    expect(card.className).toContain("cq-panel");
    expect(card.className).not.toContain("bg-white");
  });

  it("renders an Academy article with the premium article surface", () => {
    render(<AcademyArticleView article={article} related={[]} />);

    const shell = screen.getByTestId("academy-article-shell");
    expect(shell.className).toContain("text-white");
    expect(screen.getByTestId("academy-review-panel").className).toContain("cq-panel");
    expect(screen.queryByText(/Sponsored/i)).toBeNull();
  });

  it("renders Academy unavailable as a neutral premium state", () => {
    render(<AcademyUnavailable />);

    const state = screen.getByTestId("academy-unavailable-state");
    expect(state.className).toContain("cq-panel");
    expect(screen.getByText(/main Credit Quest journey is unaffected/i)).not.toBeNull();
  });
});

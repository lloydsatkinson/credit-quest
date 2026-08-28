import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AcademyArticleView } from "@/components/academy/academy-article";
import { AcademyLibrary, AcademyUnavailable } from "@/components/academy/academy-library";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const article = DEMO_ACADEMY_ARTICLES[0];

afterEach(cleanup);

describe("Academy public presentation", () => {
  it("renders the Academy library and canonical article link", () => {
    render(<AcademyLibrary articles={[article]} query="" topic={null} />);

    expect(screen.getByRole("heading", { name: /Credit Quest Academy/i })).not.toBeNull();
    expect(screen.getByRole("link", { name: article.title }).getAttribute("href")).toBe(`/learn/${article.slug}`);
  });

  it("renders reviewed education without sponsored presentation", () => {
    render(<AcademyArticleView article={article} related={[]} />);

    expect(screen.getByText(article.summary20s)).not.toBeNull();
    expect(screen.getByText(/Last reviewed/i)).not.toBeNull();
    expect(screen.getByText(/educational/i)).not.toBeNull();
    expect(screen.queryByText(/Sponsored/i)).toBeNull();
  });

  it("renders a neutral unavailable state without substitute financial guidance", () => {
    render(<AcademyUnavailable />);

    expect(screen.getByText(/temporarily unavailable/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /Credit Quest/i }).getAttribute("href")).toBe("/");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcademyArticleView } from "@/components/academy/academy-article";
import { AcademyCard } from "@/components/academy/academy-card";
import { AcademyLibrary, AcademyUnavailable } from "@/components/academy/academy-library";
import {
  AcademyArticleTracker,
  AcademyCardTracker,
  AcademySearchTracker,
} from "@/components/academy/academy-tracker";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import { trackEvent } from "@/lib/events";
import type { AcademySelection } from "@/lib/academy/types";

vi.mock("@/lib/events", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

const article = DEMO_ACADEMY_ARTICLES[0];
const selection: AcademySelection = {
  article,
  reasonType: "fallback",
  reasonKey: null,
  whyThisMatters: "A useful foundation for understanding your next steps in Credit Quest.",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

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
    expect(screen.getByRole("button", { name: "I understand this" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Still confused?" })).not.toBeNull();
    expect(screen.queryByText(/Sponsored/i)).toBeNull();
  });

  it("renders a neutral unavailable state without substitute financial guidance", () => {
    render(<AcademyUnavailable />);

    expect(screen.getByText(/temporarily unavailable/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /Credit Quest/i }).getAttribute("href")).toBe("/");
  });

  it("renders the approved learning selection without commercial presentation", () => {
    render(<AcademyCard selection={selection} />);

    expect(screen.getByText("Learn in 20 seconds", { exact: true })).not.toBeNull();
    expect(screen.getByText(selection.whyThisMatters, { exact: true })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Learn more" }).getAttribute("href")).toBe(`/learn/${selection.article.slug}`);
    expect(screen.queryByText(/Sponsored|Commercial/i)).toBeNull();
  });
});

describe("Academy best-effort tracking", () => {
  it("tracks a shown card once and posts progress", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AcademyCardTracker selection={selection} />);

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      "academy_card_shown",
      expect.objectContaining({ contentKey: article.contentKey, articleId: article.id }),
    ));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("tracks article open and accessible learning feedback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AcademyArticleTracker article={article} />);

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      "academy_article_opened",
      expect.objectContaining({ contentKey: article.contentKey, articleId: article.id }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "I understand this" }));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      "academy_article_completed",
      expect.objectContaining({ contentKey: article.contentKey }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Still confused?" }));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      "academy_still_confused",
      expect.objectContaining({ contentKey: article.contentKey }),
    ));
  });

  it("tracks Academy search only for a non-empty query", async () => {
    render(<AcademySearchTracker query="utilisation" resultCount={2} />);
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith(
      "academy_search_used",
      { query: "utilisation", resultCount: 2 },
    ));

    vi.clearAllMocks();
    cleanup();
    render(<AcademySearchTracker query="  " resultCount={29} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

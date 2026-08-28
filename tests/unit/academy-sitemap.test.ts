import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";

const listPublishedAcademyArticles = vi.fn();

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({}),
}));

vi.mock("@/lib/server/academy-repository", () => ({
  listPublishedAcademyArticles,
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => new URL("https://creditquest.example"),
}));

describe("Academy sitemap", () => {
  beforeEach(() => {
    vi.resetModules();
    listPublishedAcademyArticles.mockReset();
  });

  it("includes core and published Academy routes but excludes non-published rows", async () => {
    const published = DEMO_ACADEMY_ARTICLES[0];
    const draft = {
      ...DEMO_ACADEMY_ARTICLES[1],
      id: "00000000-0000-0000-0000-000000000099",
      slug: "draft-learning",
      contentKey: "draft-learning",
      status: "draft" as const,
      publishedAt: null,
    };
    listPublishedAcademyArticles.mockResolvedValue([published, draft]);

    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((item) => item.url);

    expect(urls).toContain("https://creditquest.example/");
    expect(urls).toContain("https://creditquest.example/learn");
    expect(urls).toContain(`https://creditquest.example/learn/${published.slug}`);
    expect(urls).not.toContain("https://creditquest.example/learn/draft-learning");
  });

  it("falls back to core static routes when configured Academy reads fail", async () => {
    listPublishedAcademyArticles.mockRejectedValue(new Error("temporary read failure"));

    const { default: sitemap } = await import("@/app/sitemap");
    const result = await sitemap();
    const urls = result.map((item) => item.url);

    expect(urls).toEqual([
      "https://creditquest.example/",
      "https://creditquest.example/learn",
    ]);
  });
});

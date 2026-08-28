import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPublishedAcademyArticleById,
  getPublishedAcademyArticleBySlug,
  listPublishedAcademyArticles,
  mapAcademyArticleRow,
  publishAcademyArticle,
  recordAcademyProgress,
  relatedAcademyArticles,
} from "@/lib/server/academy-repository";
import type { AcademyArticle } from "@/lib/academy/types";

const row = {
  id: "a1",
  content_key: "credit-file-basics",
  slug: "what-is-a-credit-file",
  version: 1,
  status: "published",
  supersedes_id: null,
  title: "What is a credit file?",
  summary_20s: "Short summary",
  body_markdown: "## Body",
  reading_minutes: 2,
  topic_tags: ["credit-file"],
  audiences: ["general"],
  mission_keys: [],
  barrier_types: [],
  passport_pillars: [],
  readiness_states: [],
  safety_tags: ["general"],
  sensitivity: "standard",
  source_name: "ICO",
  source_url: "https://ico.org.uk/for-the-public/credit/",
  reviewer: "Credit Quest Editorial",
  reviewed_at: "2026-08-28T00:00:00.000Z",
  review_due_at: null,
  published_at: "2026-08-28T00:00:00.000Z",
  created_at: "2026-08-28T00:00:00.000Z",
  updated_at: "2026-08-28T00:00:00.000Z",
};

function fakeQuery(data: unknown) {
  const eqCalls: Array<[string, unknown]> = [];
  const query = {
    select: () => query,
    eq: (field: string, value: unknown) => {
      eqCalls.push([field, value]);
      return query;
    },
    order: () => query,
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return { query, eqCalls };
}

function article(overrides: Partial<AcademyArticle> = {}): AcademyArticle {
  return {
    ...mapAcademyArticleRow(row),
    ...overrides,
  };
}

describe("Academy repository", () => {
  it("maps snake-case content rows into the Academy contract", () => {
    expect(mapAcademyArticleRow(row)).toMatchObject({
      contentKey: "credit-file-basics",
      summary20s: "Short summary",
      safetyTags: ["general"],
    });
  });

  it("lists only published Academy articles", async () => {
    const { query, eqCalls } = fakeQuery([row]);
    const supabase = { from: () => query } as unknown as SupabaseClient;

    const result = await listPublishedAcademyArticles(supabase);

    expect(eqCalls).toContainEqual(["status", "published"]);
    expect(result).toHaveLength(1);
    expect(result[0].contentKey).toBe("credit-file-basics");
  });

  it("looks up a public article by slug and by id with the published guard", async () => {
    const bySlug = fakeQuery(row);
    const slugClient = { from: () => bySlug.query } as unknown as SupabaseClient;
    expect((await getPublishedAcademyArticleBySlug(slugClient, "what-is-a-credit-file"))?.id).toBe("a1");
    expect(bySlug.eqCalls).toContainEqual(["slug", "what-is-a-credit-file"]);
    expect(bySlug.eqCalls).toContainEqual(["status", "published"]);

    const byId = fakeQuery(row);
    const idClient = { from: () => byId.query } as unknown as SupabaseClient;
    expect((await getPublishedAcademyArticleById(idClient, "a1"))?.slug).toBe("what-is-a-credit-file");
    expect(byId.eqCalls).toContainEqual(["id", "a1"]);
    expect(byId.eqCalls).toContainEqual(["status", "published"]);
  });

  it("preserves first learning timestamps on repeated progress actions", async () => {
    const existing = {
      user_id: "user-1",
      content_key: "credit-file-basics",
      last_article_id: "a1",
      first_shown_at: "2026-08-28T09:00:00.000Z",
      last_shown_at: "2026-08-28T09:05:00.000Z",
      opened_at: "2026-08-28T09:10:00.000Z",
      completed_at: null,
      still_confused_at: null,
      last_source_context: "article",
      updated_at: "2026-08-28T09:10:00.000Z",
    };
    let upserted: Record<string, unknown> | null = null;
    const readQuery = {
      select: () => readQuery,
      eq: () => readQuery,
      maybeSingle: async () => ({ data: existing, error: null }),
    };
    const admin = {
      from: () => ({
        ...readQuery,
        upsert: async (value: Record<string, unknown>) => {
          upserted = value;
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    await recordAcademyProgress(
      admin,
      "user-1",
      article(),
      "opened",
      "article",
      new Date("2026-08-28T10:00:00.000Z"),
    );

    expect(upserted).toMatchObject({
      first_shown_at: "2026-08-28T09:00:00.000Z",
      last_shown_at: "2026-08-28T09:05:00.000Z",
      opened_at: "2026-08-28T09:10:00.000Z",
    });
  });

  it("publishes only through the server-owned RPC wrapper", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const admin = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push([name, args]);
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient;

    await publishAcademyArticle(admin, "article-123");

    expect(calls).toEqual([["publish_academy_article", { p_article_id: "article-123" }]]);
  });

  it("ranks related articles by shared topic tags then stable content key", () => {
    const current = article({ contentKey: "current", topicTags: ["credit-file", "basics"] });
    const strong = article({ id: "a2", contentKey: "a-strong", slug: "a", topicTags: ["credit-file", "basics"] });
    const weakB = article({ id: "a3", contentKey: "b-weak", slug: "b", topicTags: ["credit-file"] });
    const weakA = article({ id: "a4", contentKey: "a-weak", slug: "c", topicTags: ["basics"] });

    expect(relatedAcademyArticles(current, [current, weakB, strong, weakA])).toEqual([strong, weakA, weakB]);
  });
});

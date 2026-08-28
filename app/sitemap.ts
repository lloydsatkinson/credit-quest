import type { MetadataRoute } from "next";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import { getSiteUrl } from "@/lib/site-url";
import { listPublishedAcademyArticles } from "@/lib/server/academy-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AcademyArticle } from "@/lib/academy/types";

function coreEntries(base: URL): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", base).toString() },
    { url: new URL("/learn", base).toString() },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const core = coreEntries(base);
  let articles: AcademyArticle[];

  if (!getSupabasePublicEnv()) {
    articles = DEMO_ACADEMY_ARTICLES;
  } else {
    try {
      const supabase = await createServerSupabaseClient();
      articles = await listPublishedAcademyArticles(supabase);
    } catch {
      return core;
    }
  }

  return [
    ...core,
    ...articles
      .filter((article) => article.status === "published")
      .map((article) => ({
        url: new URL(`/learn/${article.slug}`, base).toString(),
        lastModified: article.updatedAt ? new Date(article.updatedAt) : undefined,
      })),
  ];
}

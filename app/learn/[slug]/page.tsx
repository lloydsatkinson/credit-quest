import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyArticleView } from "@/components/academy/academy-article";
import { AcademyUnavailable } from "@/components/academy/academy-library";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import {
  getPublishedAcademyArticleBySlug,
  listPublishedAcademyArticles,
  relatedAcademyArticles,
} from "@/lib/server/academy-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    if (!getSupabasePublicEnv()) {
      const article = DEMO_ACADEMY_ARTICLES.find((item) => item.slug === slug);
      if (!article) return { title: "Credit Quest Academy" };
      return {
        title: `${article.title} | Credit Quest Academy`,
        description: article.summary20s,
        alternates: { canonical: `/learn/${article.slug}` },
      };
    }

    const supabase = await createServerSupabaseClient();
    const article = await getPublishedAcademyArticleBySlug(supabase, slug);
    if (!article) return { title: "Credit Quest Academy" };
    return {
      title: `${article.title} | Credit Quest Academy`,
      description: article.summary20s,
      alternates: { canonical: `/learn/${article.slug}` },
    };
  } catch {
    return { title: "Credit Quest Academy" };
  }
}

export default async function AcademyArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!getSupabasePublicEnv()) {
    const article = DEMO_ACADEMY_ARTICLES.find((item) => item.slug === slug);
    if (!article) notFound();
    return (
      <AcademyArticleView
        article={article}
        related={relatedAcademyArticles(article, DEMO_ACADEMY_ARTICLES)}
      />
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const article = await getPublishedAcademyArticleBySlug(supabase, slug);
    if (!article) notFound();
    const all = await listPublishedAcademyArticles(supabase);
    return <AcademyArticleView article={article} related={relatedAcademyArticles(article, all)} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) {
      throw error;
    }
    return <AcademyUnavailable />;
  }
}

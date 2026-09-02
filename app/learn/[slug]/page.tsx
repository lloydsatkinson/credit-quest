import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyArticleView } from "@/components/academy/academy-article";
import { AcademyUnavailable } from "@/components/academy/academy-library";
import { CustomerShell } from "@/components/customer/customer-shell";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import type { AcademyArticle } from "@/lib/academy/types";
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

function ArticleShell({ children }: { children: React.ReactNode }) {
  return <CustomerShell active="learn">{children}</CustomerShell>;
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
      <ArticleShell>
        <AcademyArticleView
          article={article}
          related={relatedAcademyArticles(article, DEMO_ACADEMY_ARTICLES)}
        />
      </ArticleShell>
    );
  }

  let article: AcademyArticle | null = null;
  let all: AcademyArticle[] = [];
  let readFailed = false;
  try {
    const supabase = await createServerSupabaseClient();
    article = await getPublishedAcademyArticleBySlug(supabase, slug);
    if (article) all = await listPublishedAcademyArticles(supabase);
  } catch {
    readFailed = true;
  }

  if (readFailed) {
    return (
      <ArticleShell>
        <AcademyUnavailable />
      </ArticleShell>
    );
  }
  if (!article) notFound();
  return (
    <ArticleShell>
      <AcademyArticleView article={article} related={relatedAcademyArticles(article, all)} />
    </ArticleShell>
  );
}

import { AcademyLibrary, AcademyUnavailable } from "@/components/academy/academy-library";
import { CustomerShell } from "@/components/customer/customer-shell";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import type { AcademyArticle } from "@/lib/academy/types";
import { listPublishedAcademyArticles } from "@/lib/server/academy-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function LearnShell({ children }: { children: React.ReactNode }) {
  return <CustomerShell active="learn">{children}</CustomerShell>;
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const topicValue = firstParam(params.topic).trim();
  const topic = topicValue || null;

  if (!getSupabasePublicEnv()) {
    return (
      <LearnShell>
        <AcademyLibrary articles={DEMO_ACADEMY_ARTICLES} query={query} topic={topic} />
      </LearnShell>
    );
  }

  let articles: AcademyArticle[] = [];
  let readFailed = false;
  try {
    const supabase = await createServerSupabaseClient();
    articles = await listPublishedAcademyArticles(supabase);
  } catch {
    readFailed = true;
  }

  if (readFailed) {
    return (
      <LearnShell>
        <AcademyUnavailable />
      </LearnShell>
    );
  }

  return (
    <LearnShell>
      <AcademyLibrary articles={articles} query={query} topic={topic} />
    </LearnShell>
  );
}

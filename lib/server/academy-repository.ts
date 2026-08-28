import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcademyArticle,
  AcademyProgress,
  AcademyProgressAction,
  AcademySourceContext,
} from "@/lib/academy/types";

const ACADEMY_SELECT = "id,content_key,slug,version,status,supersedes_id,title,summary_20s,body_markdown,reading_minutes,topic_tags,audiences,mission_keys,barrier_types,passport_pillars,readiness_states,safety_tags,sensitivity,source_name,source_url,reviewer,reviewed_at,review_due_at,published_at,created_at,updated_at";
const ACADEMY_PROGRESS_SELECT = "user_id,content_key,last_article_id,first_shown_at,last_shown_at,opened_at,completed_at,still_confused_at,last_source_context,updated_at";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function mapAcademyArticleRow(row: Record<string, unknown>): AcademyArticle {
  return {
    id: String(row.id),
    contentKey: String(row.content_key),
    slug: String(row.slug),
    version: Number(row.version),
    status: row.status as AcademyArticle["status"],
    supersedesId: nullableString(row.supersedes_id),
    title: String(row.title),
    summary20s: String(row.summary_20s),
    bodyMarkdown: String(row.body_markdown),
    readingMinutes: Number(row.reading_minutes),
    topicTags: stringArray(row.topic_tags),
    audiences: stringArray(row.audiences) as AcademyArticle["audiences"],
    missionKeys: stringArray(row.mission_keys),
    barrierTypes: stringArray(row.barrier_types) as AcademyArticle["barrierTypes"],
    passportPillars: stringArray(row.passport_pillars) as AcademyArticle["passportPillars"],
    readinessStates: stringArray(row.readiness_states) as AcademyArticle["readinessStates"],
    safetyTags: stringArray(row.safety_tags) as AcademyArticle["safetyTags"],
    sensitivity: row.sensitivity as AcademyArticle["sensitivity"],
    sourceName: String(row.source_name),
    sourceUrl: nullableString(row.source_url),
    reviewer: String(row.reviewer),
    reviewedAt: String(row.reviewed_at),
    reviewDueAt: nullableString(row.review_due_at),
    publishedAt: nullableString(row.published_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapAcademyProgressRow(row: Record<string, unknown>): AcademyProgress {
  return {
    userId: String(row.user_id),
    contentKey: String(row.content_key),
    lastArticleId: String(row.last_article_id),
    firstShownAt: nullableString(row.first_shown_at),
    lastShownAt: nullableString(row.last_shown_at),
    openedAt: nullableString(row.opened_at),
    completedAt: nullableString(row.completed_at),
    stillConfusedAt: nullableString(row.still_confused_at),
    lastSourceContext: row.last_source_context === null || row.last_source_context === undefined
      ? null
      : row.last_source_context as AcademyProgress["lastSourceContext"],
    updatedAt: String(row.updated_at),
  };
}

export async function listPublishedAcademyArticles(
  supabase: SupabaseClient,
): Promise<AcademyArticle[]> {
  const { data, error } = await supabase
    .from("academy_articles")
    .select(ACADEMY_SELECT)
    .eq("status", "published")
    .order("content_key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item) => mapAcademyArticleRow(item as Record<string, unknown>));
}

export async function getPublishedAcademyArticleBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<AcademyArticle | null> {
  const { data, error } = await supabase
    .from("academy_articles")
    .select(ACADEMY_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? mapAcademyArticleRow(data as Record<string, unknown>) : null;
}

export async function getPublishedAcademyArticleById(
  supabase: SupabaseClient,
  articleId: string,
): Promise<AcademyArticle | null> {
  const { data, error } = await supabase
    .from("academy_articles")
    .select(ACADEMY_SELECT)
    .eq("id", articleId)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? mapAcademyArticleRow(data as Record<string, unknown>) : null;
}

export async function listAcademyProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<AcademyProgress[]> {
  const { data, error } = await supabase
    .from("academy_progress")
    .select(ACADEMY_PROGRESS_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => mapAcademyProgressRow(item as Record<string, unknown>));
}

export async function recordAcademyProgress(
  admin: SupabaseClient,
  userId: string,
  article: AcademyArticle,
  action: AcademyProgressAction,
  sourceContext: AcademySourceContext,
  now = new Date(),
): Promise<void> {
  const { data, error: readError } = await admin
    .from("academy_progress")
    .select(ACADEMY_PROGRESS_SELECT)
    .eq("user_id", userId)
    .eq("content_key", article.contentKey)
    .maybeSingle();
  if (readError) throw readError;

  const existing = data ? mapAcademyProgressRow(data as Record<string, unknown>) : null;
  const timestamp = now.toISOString();

  const row = {
    user_id: userId,
    content_key: article.contentKey,
    last_article_id: article.id,
    first_shown_at: existing?.firstShownAt ?? (action === "shown" ? timestamp : null),
    last_shown_at: action === "shown" ? timestamp : existing?.lastShownAt ?? null,
    opened_at: action === "opened" ? timestamp : existing?.openedAt ?? null,
    completed_at: action === "completed" ? timestamp : existing?.completedAt ?? null,
    still_confused_at: action === "still_confused" ? timestamp : existing?.stillConfusedAt ?? null,
    last_source_context: sourceContext,
    updated_at: timestamp,
  };

  const { error: writeError } = await admin
    .from("academy_progress")
    .upsert(row, { onConflict: "user_id,content_key" });
  if (writeError) throw writeError;
}

export function relatedAcademyArticles(
  article: AcademyArticle,
  all: AcademyArticle[],
  limit = 3,
): AcademyArticle[] {
  const currentTags = new Set(article.topicTags);
  return all
    .filter((candidate) => candidate.contentKey !== article.contentKey)
    .map((candidate) => ({
      candidate,
      score: candidate.topicTags.reduce(
        (count, tag) => count + (currentTags.has(tag) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.candidate.contentKey.localeCompare(right.candidate.contentKey);
    })
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export async function publishAcademyArticle(
  admin: SupabaseClient,
  articleId: string,
): Promise<void> {
  const { error } = await admin.rpc("publish_academy_article", {
    p_article_id: articleId,
  });
  if (error) throw error;
}

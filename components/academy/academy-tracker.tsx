"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AcademyArticle,
  AcademyProgressAction,
  AcademySelection,
  AcademySourceContext,
} from "@/lib/academy/types";
import { trackEvent } from "@/lib/events";

async function postProgress(
  article: AcademyArticle,
  action: AcademyProgressAction,
  sourceContext: AcademySourceContext,
): Promise<void> {
  try {
    await fetch("/api/academy/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        contentKey: article.contentKey,
        articleId: article.id,
        sourceContext,
      }),
      keepalive: true,
    });
  } catch {
    // Learning analytics are best-effort and must never block Academy content.
  }
}

function articleMetadata(article: AcademyArticle) {
  return {
    contentKey: article.contentKey,
    articleId: article.id,
    slug: article.slug,
    version: article.version,
  };
}

export function AcademyCardTracker({ selection }: { selection: AcademySelection | null }) {
  const trackedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!selection) return;
    const article = selection.article;
    const identity = `${article.id}:${article.version}`;
    if (trackedKey.current === identity) return;
    trackedKey.current = identity;

    void trackEvent("academy_card_shown", {
      ...articleMetadata(article),
      reasonType: selection.reasonType,
      reasonKey: selection.reasonKey,
    });
    void postProgress(article, "shown", "quest_feed");
  }, [selection]);

  return null;
}

export function AcademyArticleTracker({ article }: { article: AcademyArticle }) {
  const trackedKey = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<"completed" | "still_confused" | null>(null);

  useEffect(() => {
    const identity = `${article.id}:${article.version}`;
    if (trackedKey.current === identity) return;
    trackedKey.current = identity;

    void trackEvent("academy_article_opened", articleMetadata(article));
    void postProgress(article, "opened", "article");
  }, [article]);

  function recordFeedback(action: "completed" | "still_confused") {
    setFeedback(action);
    const eventName = action === "completed"
      ? "academy_article_completed"
      : "academy_still_confused";
    void trackEvent(eventName, articleMetadata(article));
    void postProgress(article, action, "article");
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Academy feedback">
      <p className="font-black text-slate-950">Did this make sense?</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">Your feedback helps Credit Quest improve explanations. It does not change your missions, Passport or readiness.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => recordFeedback("completed")}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
        >
          I understand this
        </button>
        <button
          type="button"
          onClick={() => recordFeedback("still_confused")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
        >
          Still confused?
        </button>
      </div>
      {feedback ? (
        <p role="status" className="mt-3 text-sm font-bold text-violet-700">
          {feedback === "completed" ? "Thanks — marked as understood." : "Thanks — we’ll use that signal to improve the explanation."}
        </p>
      ) : null}
    </section>
  );
}

export function AcademySearchTracker({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) {
  const trackedQuery = useRef<string | null>(null);

  useEffect(() => {
    const normalised = query.trim();
    if (!normalised || trackedQuery.current === normalised) return;
    trackedQuery.current = normalised;
    void trackEvent("academy_search_used", { query: normalised, resultCount });
  }, [query, resultCount]);

  return null;
}

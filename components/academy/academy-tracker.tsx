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
    <section className="cq-panel mt-8 rounded-3xl p-5" aria-label="Academy feedback">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-lime-300/15 bg-lime-300/[0.055] text-sm font-black text-lime-300" aria-hidden="true">?</span>
        <div>
          <p className="font-black text-white">Did this make sense?</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">Your feedback helps Credit Quest improve explanations. It does not change your missions, Passport or readiness.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => recordFeedback("completed")}
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_10px_32px_rgba(31,228,255,0.12)] transition hover:bg-cyan-200"
        >
          I understand this
        </button>
        <button
          type="button"
          onClick={() => recordFeedback("still_confused")}
          className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-300 transition hover:border-cyan-300/20 hover:text-white"
        >
          Still confused?
        </button>
      </div>
      {feedback ? (
        <p role="status" className="mt-4 rounded-2xl border border-lime-300/15 bg-lime-300/[0.045] p-3 text-sm font-bold text-lime-100">
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

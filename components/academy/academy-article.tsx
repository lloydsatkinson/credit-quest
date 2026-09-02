import Link from "next/link";
import { AcademyArticleTracker } from "@/components/academy/academy-tracker";
import { AcademyMarkdown } from "@/lib/academy/markdown";
import type { AcademyArticle } from "@/lib/academy/types";

function reviewedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function AcademyArticleView({
  article,
  related,
}: {
  article: AcademyArticle;
  related: AcademyArticle[];
}) {
  return (
    <main
      data-testid="academy-article-shell"
      className="mx-auto min-h-screen max-w-3xl px-5 py-7 text-white sm:px-6 sm:py-10"
    >
      <header className="flex items-center justify-between gap-4">
        <Link href="/learn" className="font-black text-cyan-300 transition hover:text-cyan-200">
          ← Credit Quest Academy
        </Link>
        <span className="rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">
          Reviewed learning
        </span>
      </header>

      <article className="mt-6">
        <section className="cq-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-60 rounded-full bg-cyan-300/[0.07] blur-3xl" />
          <div className="relative">
            <p className="cq-kicker">Learn in plain English</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">{article.title}</h1>
            <p className="mt-5 text-xl font-semibold leading-8 text-slate-200">{article.summary20s}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Read time</p>
                <p className="mt-2 font-black text-white">{article.readingMinutes} min</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Last reviewed</p>
                <p className="mt-2 text-sm font-black text-white">{reviewedDate(article.reviewedAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Reviewer</p>
                <p className="mt-2 text-sm font-black text-white">{article.reviewer}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cq-panel mt-5 rounded-[2rem] p-6 sm:p-8">
          <div className="academy-article-content text-slate-300">
            <AcademyMarkdown markdown={article.bodyMarkdown} />
          </div>
          <AcademyArticleTracker article={article} />
        </section>

        <aside
          data-testid="academy-review-panel"
          className="cq-panel mt-5 rounded-3xl border-cyan-300/10 p-5 text-sm leading-6 text-slate-400"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200" aria-hidden="true">✓</span>
            <div>
              <p className="font-black text-white">Source and review</p>
              <p className="text-xs text-slate-500">Visible source trail and review details.</p>
            </div>
          </div>
          <p className="mt-4">
            Source: {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-cyan-300 underline decoration-cyan-300/30 underline-offset-4"
              >
                {article.sourceName}
              </a>
            ) : article.sourceName}
          </p>
          <p className="mt-3 text-slate-500">
            Credit Quest Academy is educational. It explains credit concepts and Credit Quest guidance, but it does not predict whether a lender will approve an application.
          </p>
        </aside>
      </article>

      {related.length > 0 ? (
        <section className="mt-10" aria-labelledby="related-learning">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="cq-kicker">Keep learning</p>
              <h2 id="related-learning" className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Related learning</h2>
            </div>
            <Link href="/learn" className="text-sm font-black text-cyan-300">All lessons</Link>
          </div>
          <div className="mt-4 grid gap-3">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/learn/${item.slug}`}
                className="cq-panel group rounded-2xl p-4 font-bold text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:text-cyan-200"
              >
                <span className="flex items-center justify-between gap-4">
                  <span>{item.title}</span>
                  <span className="text-cyan-300" aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

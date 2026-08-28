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
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10 sm:py-14">
      <Link href="/learn" className="text-sm font-bold text-violet-700 hover:text-violet-900">
        ← Credit Quest Academy
      </Link>

      <article className="mt-8">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Learn in plain English</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{article.title}</h1>
        <p className="mt-5 text-xl leading-8 text-slate-700">{article.summary20s}</p>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>{article.readingMinutes} min read</span>
          <span>Last reviewed {reviewedDate(article.reviewedAt)}</span>
          <span>Reviewed by {article.reviewer}</span>
        </div>

        <div className="mt-9">
          <AcademyMarkdown markdown={article.bodyMarkdown} />
        </div>

        <AcademyArticleTracker article={article} />

        <aside className="mt-10 rounded-3xl border border-violet-100 bg-violet-50 p-5 text-sm leading-6 text-slate-700">
          <p className="font-black text-slate-950">Source and review</p>
          <p className="mt-2">
            Source: {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-violet-700 underline underline-offset-4"
              >
                {article.sourceName}
              </a>
            ) : article.sourceName}
          </p>
          <p className="mt-3 text-slate-600">
            Credit Quest Academy is educational. It explains credit concepts and Credit Quest guidance, but it does not predict whether a lender will approve an application.
          </p>
        </aside>
      </article>

      {related.length > 0 ? (
        <section className="mt-12" aria-labelledby="related-learning">
          <h2 id="related-learning" className="text-2xl font-black tracking-tight text-slate-950">Related learning</h2>
          <div className="mt-4 grid gap-3">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/learn/${item.slug}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 font-bold text-slate-800 shadow-sm hover:border-violet-200 hover:text-violet-700"
              >
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

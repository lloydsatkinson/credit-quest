import Link from "next/link";
import { AcademySearchTracker } from "@/components/academy/academy-tracker";
import type { AcademyArticle } from "@/lib/academy/types";

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

export function AcademyLibrary({
  articles,
  query,
  topic,
}: {
  articles: AcademyArticle[];
  query: string;
  topic: string | null;
}) {
  const q = normalise(query);
  const topicFilter = topic ? normalise(topic) : null;

  const filtered = articles.filter((article) => {
    const matchesTopic = topicFilter === null
      || article.topicTags.some((tag) => normalise(tag) === topicFilter);
    if (!matchesTopic) return false;
    if (!q) return true;

    const searchable = [
      article.title,
      article.summary20s,
      ...article.topicTags,
    ].map(normalise);
    return searchable.some((value) => value.includes(q));
  });

  const topics = [...new Set(articles.flatMap((article) => article.topicTags))]
    .sort((a, b) => a.localeCompare(b));

  return (
    <main
      data-testid="academy-library-shell"
      className="mx-auto min-h-screen max-w-5xl px-5 py-7 text-white sm:px-6 sm:py-10"
    >
      <AcademySearchTracker query={query} resultCount={filtered.length} />

      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="cq-kicker">Credit Academy</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Short lessons. Clear next moves.</p>
        </div>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
          Education · never approval
        </span>
      </header>

      <section className="cq-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-64 rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-20 size-64 rounded-full bg-fuchsia-400/[0.05] blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-lime-300">
              Learn in plain English
            </span>
            <span className="text-xs font-bold text-slate-500">Reviewed Credit Quest guidance</span>
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
            Credit Quest Academy
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-slate-200">
            Understand the signal before you act on it.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Short, practical explanations of credit basics, what can affect your profile, and why Credit Quest may suggest a particular next step.
          </p>
        </div>
      </section>

      <form
        action="/learn"
        data-testid="academy-search-panel"
        className="cq-panel mt-6 grid gap-3 rounded-3xl p-4 sm:grid-cols-[1fr_auto]"
      >
        <label className="sr-only" htmlFor="academy-search">Search Academy</label>
        <input
          id="academy-search"
          name="q"
          defaultValue={query}
          placeholder="Search credit topics"
          className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15"
        />
        <button
          className="rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950 shadow-[0_12px_40px_rgba(34,211,238,0.12)] transition hover:bg-cyan-200"
          type="submit"
        >
          Search
        </button>
      </form>

      {topics.length > 0 ? (
        <nav aria-label="Academy topics" className="mt-5 flex flex-wrap gap-2">
          <Link
            href={q ? `/learn?q=${encodeURIComponent(query)}` : "/learn"}
            className={`rounded-full border px-3 py-1.5 text-sm font-black transition ${topicFilter === null ? "border-lime-300/25 bg-lime-300/10 text-lime-300" : "border-white/10 bg-white/[0.035] text-slate-400 hover:border-cyan-300/20 hover:text-white"}`}
          >
            All topics
          </Link>
          {topics.map((tag) => {
            const selected = normalise(tag) === topicFilter;
            return (
              <Link
                key={tag}
                href={`/learn?topic=${encodeURIComponent(tag)}${q ? `&q=${encodeURIComponent(query)}` : ""}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-black transition ${selected ? "border-lime-300/25 bg-lime-300/10 text-lime-300" : "border-cyan-300/12 bg-cyan-300/[0.035] text-cyan-100 hover:border-cyan-300/25"}`}
              >
                {tag.replaceAll("-", " ")}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <section aria-label="Academy articles" className="mt-8 grid gap-4 md:grid-cols-2">
        {filtered.map((article) => (
          <article
            key={article.id}
            data-testid={`academy-card-${article.id}`}
            className="cq-panel group flex flex-col rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/20"
          >
            <div className="flex items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              <span>{article.readingMinutes} min read</span>
              <span className="text-lime-300">Reviewed</span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-white">
              <Link href={`/learn/${article.slug}`} className="transition group-hover:text-cyan-200">
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 flex-1 leading-7 text-slate-400">{article.summary20s}</p>
            <Link href={`/learn/${article.slug}`} className="mt-6 inline-flex items-center gap-2 font-black text-cyan-300">
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>

      {filtered.length === 0 ? (
        <div className="cq-panel mt-8 rounded-3xl border-dashed p-6 text-slate-400">
          <p className="font-black text-white">No matching Academy lesson yet.</p>
          <p className="mt-2 text-sm leading-6">Try a broader search term or return to all topics.</p>
          <Link href="/learn" className="mt-4 inline-flex font-black text-cyan-300">View all topics →</Link>
        </div>
      ) : null}

      <p className="mt-10 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-slate-500">
        Academy content is educational. It does not predict lender approval and does not replace personalised financial or debt advice.
      </p>
    </main>
  );
}

export function AcademyUnavailable() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-12 text-white sm:px-6">
      <section data-testid="academy-unavailable-state" className="cq-panel w-full rounded-[2rem] p-7 sm:p-9">
        <p className="cq-kicker">Credit Quest Academy</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white">Learning is temporarily unavailable.</h1>
        <p className="mt-4 leading-7 text-slate-400">
          The Academy could not be loaded right now. Your main Credit Quest journey is unaffected.
        </p>
        <Link href="/" className="mt-7 inline-flex rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-200">
          Back to Credit Quest
        </Link>
      </section>
    </main>
  );
}

import Link from "next/link";
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
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:py-14">
      <div className="max-w-3xl">
        <Link href="/" className="text-sm font-bold text-violet-700 hover:text-violet-900">
          ← Credit Quest
        </Link>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.18em] text-violet-600">Learn</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Credit Quest Academy
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          Short, practical explanations of credit basics, what can affect your profile, and why Credit Quest may suggest a particular next step.
        </p>
      </div>

      <form action="/learn" className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="academy-search">Search Academy</label>
        <input
          id="academy-search"
          name="q"
          defaultValue={query}
          placeholder="Search credit topics"
          className="min-w-0 rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none ring-violet-500 focus:ring-2"
        />
        <button className="rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white" type="submit">
          Search
        </button>
      </form>

      {topics.length > 0 ? (
        <nav aria-label="Academy topics" className="mt-5 flex flex-wrap gap-2">
          <Link
            href={q ? `/learn?q=${encodeURIComponent(query)}` : "/learn"}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700"
          >
            All topics
          </Link>
          {topics.map((tag) => (
            <Link
              key={tag}
              href={`/learn?topic=${encodeURIComponent(tag)}${q ? `&q=${encodeURIComponent(query)}` : ""}`}
              className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700"
            >
              {tag.replaceAll("-", " ")}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-label="Academy articles" className="mt-8 grid gap-4 md:grid-cols-2">
        {filtered.map((article) => (
          <article key={article.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <span>{article.readingMinutes} min read</span>
              <span>Reviewed</span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
              <Link href={`/learn/${article.slug}`} className="hover:text-violet-700">
                {article.title}
              </Link>
            </h2>
            <p className="mt-3 flex-1 leading-7 text-slate-600">{article.summary20s}</p>
            <Link href={`/learn/${article.slug}`} className="mt-6 font-black text-violet-700">
              Learn more →
            </Link>
          </article>
        ))}
      </section>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-slate-600">
          No Academy topics match that search yet. Try a broader term or view all topics.
        </div>
      ) : null}

      <p className="mt-10 text-sm leading-6 text-slate-500">
        Academy content is educational. It does not predict lender approval and does not replace personalised financial or debt advice.
      </p>
    </main>
  );
}

export function AcademyUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Credit Quest Academy</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Learning is temporarily unavailable.</h1>
      <p className="mt-4 leading-7 text-slate-600">
        The Academy could not be loaded right now. Your main Credit Quest journey is unaffected.
      </p>
      <Link href="/" className="mt-7 w-fit rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white">
        Back to Credit Quest
      </Link>
    </main>
  );
}

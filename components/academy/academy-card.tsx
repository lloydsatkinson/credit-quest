import Link from "next/link";
import { AcademyCardTracker } from "@/components/academy/academy-tracker";
import type { AcademySelection } from "@/lib/academy/types";

export function AcademyCard({ selection }: { selection: AcademySelection | null }) {
  if (!selection) {
    return (
      <div data-testid="academy-feed-card" className="flex flex-1 flex-col justify-center text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Learn in 20 seconds</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Learning is temporarily unavailable.</h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Your missions, Passport and readiness guidance are unaffected.</p>
      </div>
    );
  }

  return (
    <div data-testid="academy-feed-card" className="flex flex-1 flex-col justify-center text-white">
      <AcademyCardTracker selection={selection} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Learn in 20 seconds</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{selection.article.title}</h2>
      <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-200">{selection.article.summary20s}</p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{selection.whyThisMatters}</p>
      <Link
        href={`/learn/${selection.article.slug}`}
        className="mt-6 inline-flex w-fit rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(31,228,255,0.09)] transition hover:bg-cyan-200"
      >
        Learn more
      </Link>
    </div>
  );
}

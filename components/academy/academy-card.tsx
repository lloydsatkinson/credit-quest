import Link from "next/link";
import { AcademyCardTracker } from "@/components/academy/academy-tracker";
import type { AcademySelection } from "@/lib/academy/types";

export function AcademyCard({ selection }: { selection: AcademySelection | null }) {
  if (!selection) {
    return (
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Learn in 20 seconds</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Learning is temporarily unavailable.</h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Your missions, Passport and readiness guidance are unaffected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center">
      <AcademyCardTracker selection={selection} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Learn in 20 seconds</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{selection.article.title}</h2>
      <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-700">{selection.article.summary20s}</p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">{selection.whyThisMatters}</p>
      <Link
        href={`/learn/${selection.article.slug}`}
        className="mt-6 inline-flex w-fit rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white"
      >
        Learn more
      </Link>
    </div>
  );
}

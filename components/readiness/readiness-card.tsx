import Link from "next/link";
import type { ApplicationReadiness, ReadinessState } from "@/lib/domain/types";

const stateClasses: Record<ReadinessState, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-rose-100 text-rose-800",
  unknown: "bg-slate-200 text-slate-700",
};

function stateLabel(state: ReadinessState): string {
  return state === "green" ? "Green" : state === "amber" ? "Amber" : state === "red" ? "Red" : "Unknown";
}

export function ReadinessCard({ readiness }: { readiness: ApplicationReadiness }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Can I apply yet?</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${stateClasses[readiness.state]}`}>
          {stateLabel(readiness.state)}
        </span>
      </div>

      <p className="mt-7 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
        {readiness.headline}
      </p>
      {readiness.reasons[0] ? (
        <p className="mt-4 max-w-xl leading-7 text-slate-600">{readiness.reasons[0]}</p>
      ) : null}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-violet-700">Do now</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{readiness.actions[0] ?? "Keep your profile information up to date."}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Avoid now</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{readiness.avoid[0] ?? "Avoid unnecessary hard applications."}</p>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-500">
        This is Credit Quest guidance, not a lender approval prediction. Green means only that the blockers Credit Quest currently checks are not present.
      </p>

      <Link
        href="/readiness"
        className="mt-auto pt-6 text-center text-sm font-black text-violet-700 underline decoration-violet-300 underline-offset-4"
      >
        Understand my readiness
      </Link>
    </div>
  );
}

import Link from "next/link";
import type { ApplicationReadiness, ReadinessState } from "@/lib/domain/types";

const stateClasses: Record<ReadinessState, string> = {
  green: "border-lime-300/25 bg-lime-300/10 text-lime-300",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  red: "border-rose-300/25 bg-rose-300/10 text-rose-300",
  unknown: "border-white/10 bg-white/[0.045] text-slate-400",
};

const glowClasses: Record<ReadinessState, string> = {
  green: "bg-lime-300/10 shadow-[0_0_70px_rgba(200,255,56,0.08)]",
  amber: "bg-amber-300/10 shadow-[0_0_70px_rgba(252,211,77,0.07)]",
  red: "bg-rose-300/10 shadow-[0_0_70px_rgba(253,164,175,0.07)]",
  unknown: "bg-cyan-300/[0.055] shadow-[0_0_70px_rgba(31,228,255,0.06)]",
};

function stateLabel(state: ReadinessState): string {
  return state === "green" ? "Green" : state === "amber" ? "Amber" : state === "red" ? "Red" : "Unknown";
}

export function ReadinessCard({ readiness }: { readiness: ApplicationReadiness }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">Application readiness</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Can I apply yet?</h2>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${stateClasses[readiness.state]}`}>
          {stateLabel(readiness.state)}
        </span>
      </div>

      <div className={`relative mt-7 overflow-hidden rounded-[1.75rem] border border-white/8 p-5 sm:p-6 ${glowClasses[readiness.state]}`}>
        <div className="absolute -right-10 -top-12 size-36 rounded-full bg-white/[0.035] blur-2xl" aria-hidden="true" />
        <p className="relative text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl">
          {readiness.headline}
        </p>
        {readiness.reasons[0] ? (
          <p className="relative mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{readiness.reasons[0]}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.055] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">Do now</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{readiness.actions[0] ?? "Keep your profile information up to date."}</p>
        </div>
        <div className="rounded-2xl border border-fuchsia-300/10 bg-fuchsia-300/[0.045] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-fuchsia-300">Avoid now</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{readiness.avoid[0] ?? "Avoid unnecessary hard applications."}</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        This is Credit Quest guidance, not a lender approval prediction. Green means only that the blockers Credit Quest currently checks are not present.
      </p>

      <Link
        href="/readiness"
        className="mt-auto pt-5 text-center text-sm font-black text-lime-300 underline decoration-lime-300/25 underline-offset-4 hover:text-white"
      >
        Understand my readiness
      </Link>
    </div>
  );
}

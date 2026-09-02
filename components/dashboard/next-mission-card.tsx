import Link from "next/link";
import type { MissionProgress, OfferDefinition, RankedMission } from "@/lib/domain/types";

export function NextMissionCard({
  rankedMission,
  progress,
  offer,
  reviewTiming,
  actionHref,
  onStart,
  onDefer,
  embedded = false,
}: {
  rankedMission: RankedMission;
  progress?: MissionProgress;
  offer?: OfferDefinition;
  reviewTiming?: string;
  actionHref?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDefer?: () => void;
  embedded?: boolean;
}) {
  const { mission, reasons } = rankedMission;
  const isStarted = progress?.state === "started";

  return (
    <section className={embedded ? "flex h-full flex-col" : "rounded-3xl border border-cyan-300/15 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/40"}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">{mission.impact} impact</span>
        <span className="text-xs font-black text-lime-300">+{mission.questScoreDelta} Quest Score</span>
      </div>
      <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">{mission.title}</h2>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">{mission.description}</p>

      {!embedded ? (
        <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Why this matters</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{mission.rationale}</p>
          <p className="mt-2 text-sm text-slate-400">{reasons[0]}</p>
        </div>
      ) : reasons[0] ? (
        <div className="mt-6 rounded-2xl border border-white/7 bg-white/[0.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">Why now</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{reasons[0]}</p>
        </div>
      ) : null}

      {reviewTiming && <p className="mt-4 text-xs font-bold text-slate-500">Review timing: {reviewTiming}</p>}

      <div className={embedded ? "mt-auto pt-8" : "mt-6"}>
        {actionHref ? (
          <Link
            href={actionHref}
            aria-label={isStarted ? "Continue this mission" : "Start this mission"}
            className="group flex w-full items-center justify-between rounded-2xl bg-lime-300 px-5 py-4 font-black text-slate-950 shadow-[0_0_36px_rgba(200,255,56,0.12)] transition hover:bg-lime-200"
          >
            <span>{isStarted ? "Continue this mission" : "Take action"}</span>
            <span className="text-xl transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </Link>
        ) : isStarted ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-5 py-3.5 text-center text-sm font-bold text-slate-300">
            This mission is ready to continue through its action journey.
          </div>
        ) : (
          <button
            onClick={onStart}
            aria-label="Start this mission"
            className="flex w-full items-center justify-between rounded-2xl bg-lime-300 px-5 py-4 font-black text-slate-950 shadow-[0_0_36px_rgba(200,255,56,0.12)] transition hover:bg-lime-200"
          >
            <span>Take action</span><span className="text-xl" aria-hidden="true">→</span>
          </button>
        )}

        {onDefer && (
          <button type="button" onClick={onDefer} className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-400 transition hover:bg-white/5 hover:text-white">
            Do this later
          </button>
        )}
      </div>

      {offer && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-sm font-bold">Optional route: {offer.productName}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{offer.disclosure} Credit Quest does not know whether you will be approved.</p>
          <a className="mt-3 inline-block text-sm font-black text-cyan-300 underline" href={offer.affiliateUrl} target="_blank" rel="noreferrer sponsored">Check eligibility with provider</a>
        </div>
      )}
    </section>
  );
}

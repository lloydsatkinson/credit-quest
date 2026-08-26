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
}: {
  rankedMission: RankedMission;
  progress?: MissionProgress;
  offer?: OfferDefinition;
  reviewTiming?: string;
  actionHref?: string;
  onStart?: () => void;
  onComplete?: () => void;
  onDefer?: () => void;
}) {
  const { mission, reasons } = rankedMission;
  const isStarted = progress?.state === "started";

  return (
    <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider">{mission.impact} impact</span>
        <span className="text-sm font-bold text-violet-200">Estimated +{mission.questScoreDelta} Quest Score</span>
      </div>
      <h2 className="mt-5 text-3xl font-black tracking-tight">{mission.title}</h2>
      <p className="mt-3 leading-7 text-slate-300">{mission.description}</p>
      <div className="mt-5 rounded-2xl bg-white/8 p-4">
        <p className="text-xs font-black uppercase tracking-wider text-violet-200">Why this matters</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{mission.rationale}</p>
        <p className="mt-2 text-sm text-slate-400">{reasons[0]}</p>
      </div>
      {reviewTiming && <p className="mt-4 text-sm text-slate-400">Review timing: {reviewTiming}</p>}

      {isStarted ? (
        actionHref ? (
          <Link
            href={actionHref}
            className="mt-6 block w-full rounded-2xl bg-violet-500 px-5 py-3 text-center font-black text-white hover:bg-violet-400"
          >
            Continue this mission
          </Link>
        ) : (
          <div className="mt-6 rounded-2xl bg-white/8 px-5 py-3 text-center text-sm font-bold text-slate-300">
            This mission is ready to continue through its action journey.
          </div>
        )
      ) : (
        <button onClick={onStart} className="mt-6 w-full rounded-2xl bg-violet-500 px-5 py-3 font-black text-white hover:bg-violet-400">
          Start this mission
        </button>
      )}

      {onDefer && (
        <button type="button" onClick={onDefer} className="mt-3 w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/5">
          Do this later
        </button>
      )}

      {offer && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-sm font-bold">Optional route: {offer.productName}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{offer.disclosure} Credit Quest does not know whether you will be approved.</p>
          <a className="mt-3 inline-block text-sm font-black text-violet-300 underline" href={offer.affiliateUrl} target="_blank" rel="noreferrer sponsored">Check eligibility with provider</a>
        </div>
      )}
    </section>
  );
}

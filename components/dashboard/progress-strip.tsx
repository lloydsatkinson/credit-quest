import type { JourneyStage } from "@/lib/domain/types";

const labels: Record<JourneyStage, string> = {
  setup: "Setup",
  stabilise: "Stabilise",
  build: "Build",
  optimise: "Optimise",
  maintain: "Maintain",
};

export function ProgressStrip({ score, stage, completed, nextReview }: { score: number; stage: JourneyStage; completed: number; nextReview: string }) {
  return (
    <section className="flex flex-1 flex-col justify-between">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Quest Score</p>
            <p className="mt-2 text-6xl font-black tracking-[-0.06em] text-slate-950">{score}</p>
          </div>
          <span className="rounded-full bg-violet-100 px-3 py-1.5 text-sm font-black text-violet-700">{labels[stage]}</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Quest Score ${score} out of 100`}>
          <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Missions done</p>
          <p data-testid="missions-done" className="mt-2 text-2xl font-black text-slate-950">{completed}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Next review</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{nextReview}</p>
        </div>
      </div>
    </section>
  );
}

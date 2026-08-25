import type { JourneyStage } from "@/lib/domain/types";

const labels: Record<JourneyStage, string> = {
  setup: "Setup",
  stabilise: "Stabilise",
  build: "Build",
  optimise: "Optimise",
  maintain: "Maintain",
};

export function ProgressStrip({ score, stage, completed, nextReview }: { score: number; stage: JourneyStage; completed: number; nextReview: string }) {
  const items = [
    ["Quest Score", `${score}/100`],
    ["Stage", labels[stage]],
    ["Missions done", String(completed)],
    ["Next review", nextReview],
  ];
  return <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>)}</section>;
}

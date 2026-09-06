import type { RecoveryExperienceProjection } from "@/lib/recovery/experience";

export function RecoveryProgressCard({ projection }: { projection: RecoveryExperienceProjection }) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Your path back</p>
      <div className="mt-5 grid grid-cols-5 gap-2" role="list" aria-label="Recovery progress">
        {projection.timeline.map((step) => (
          <div key={step.key} role="listitem" data-testid="recovery-progress-step" className="text-center">
            <div className={`mx-auto flex size-9 items-center justify-center rounded-full border text-sm font-black ${
              step.state === "current"
                ? "border-lime-300/40 bg-lime-300/10 text-lime-300"
                : step.state === "complete"
                  ? "border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-300"
                  : "border-white/10 bg-white/[0.025] text-slate-600"
            }`} aria-current={step.state === "current" ? "step" : undefined}>
              {step.state === "complete" ? "✓" : step.state === "current" ? "●" : "○"}
            </div>
            <p className={`mt-2 text-[9px] font-black uppercase tracking-[0.06em] ${
              step.state === "current" ? "text-lime-300" : step.state === "complete" ? "text-slate-300" : "text-slate-600"
            }`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm font-semibold leading-6 text-slate-400">{projection.reassessment.label}</p>
    </div>
  );
}

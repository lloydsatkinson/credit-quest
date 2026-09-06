import Link from "next/link";
import type {
  RecoveryExperienceProjection,
  RecoveryTimelineItem,
} from "@/lib/recovery/experience";

const STAGE_LABEL: Record<RecoveryExperienceProjection["stage"], string> = {
  intake: "Understanding your position",
  crisis_recovery: "Protecting stability",
  stability: "Stabilising",
  rebuilding: "Rebuilding",
  optimisation: "Optimising",
  ready_to_check: "Ready to check",
};

const STEP_MARK: Record<RecoveryTimelineItem["state"], string> = {
  complete: "✓",
  current: "●",
  future: "○",
};

function metadata(projection: RecoveryExperienceProjection): string[] {
  const values: string[] = [];
  if (projection.nextAction.impactLabel) values.push(`${projection.nextAction.impactLabel} impact`);
  if (projection.nextAction.effortLabel) values.push(projection.nextAction.effortLabel);
  if (projection.nextAction.reviewTimingLabel) values.push(projection.nextAction.reviewTimingLabel);
  return values;
}

export function RecoveryHero({
  projection,
}: {
  projection: RecoveryExperienceProjection;
}) {
  const actionMetadata = metadata(projection);
  const canTakeAction = projection.state === "action_required" && Boolean(projection.nextAction.actionHref);

  return (
    <section
      aria-label="Your recovery plan"
      className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[#07101a] p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.38)] sm:p-7"
    >
      <div className="absolute -right-20 -top-24 size-64 rounded-full bg-cyan-300/[0.05] blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -left-16 size-56 rounded-full bg-violet-400/[0.045] blur-3xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Your recovery plan</p>
            <p className="mt-2 text-xs font-bold text-slate-500">{STAGE_LABEL[projection.stage]}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
            {projection.readiness.explanation}
          </span>
        </div>

        <h2 className="mt-6 max-w-3xl text-3xl font-black leading-[1.04] tracking-[-0.035em] sm:text-4xl">
          {projection.headline}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
          {projection.summary}
        </p>

        <div className="mt-6 rounded-[1.5rem] border border-white/8 bg-white/[0.035] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-500">
            {projection.state === "action_required" ? "Do this now" : "Current position"}
          </p>
          <p className="mt-2 text-xl font-black text-white">{projection.nextAction.title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{projection.nextAction.rationale}</p>

          {actionMetadata.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {actionMetadata.map((item) => (
                <span key={item} className="rounded-full border border-cyan-300/12 bg-cyan-300/[0.055] px-3 py-1.5 text-xs font-black text-cyan-200">
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {canTakeAction && projection.nextAction.actionHref ? (
            <Link
              href={projection.nextAction.actionHref}
              className="mt-5 flex w-full items-center justify-between rounded-2xl bg-lime-300 px-5 py-4 font-black text-slate-950 transition hover:bg-lime-200 sm:max-w-sm"
            >
              <span>Start quest</span>
              <span aria-hidden="true" className="text-xl">→</span>
            </Link>
          ) : null}
        </div>

        <div className="mt-6" aria-label="Recovery timeline">
          <div className="flex items-center justify-between gap-1" role="list">
            {projection.timeline.map((step) => {
              const current = step.state === "current";
              return (
                <div
                  key={step.key}
                  role="listitem"
                  data-testid="recovery-timeline-step"
                  className="min-w-0 flex-1 text-center"
                >
                  {current ? (
                    <span
                      data-testid="recovery-timeline-current"
                      aria-current="step"
                      className="mx-auto flex size-8 items-center justify-center rounded-full border border-lime-300/40 bg-lime-300/10 text-sm font-black text-lime-300"
                    >
                      {STEP_MARK[step.state]}
                    </span>
                  ) : (
                    <span
                      className={`mx-auto flex size-8 items-center justify-center rounded-full border text-sm font-black ${
                        step.state === "complete"
                          ? "border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-300"
                          : "border-white/10 bg-white/[0.025] text-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {STEP_MARK[step.state]}
                    </span>
                  )}
                  <span className={`mt-2 block truncate text-[9px] font-black uppercase tracking-[0.08em] ${current ? "text-lime-300" : step.state === "complete" ? "text-slate-300" : "text-slate-600"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-5 text-xs font-semibold leading-5 text-slate-500">
          {projection.reassessment.label}
        </p>
      </div>
    </section>
  );
}

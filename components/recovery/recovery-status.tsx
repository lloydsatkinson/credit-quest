import type { RecoveryPlanProjection } from "@/lib/recovery/plan";

const STAGE_COPY: Record<RecoveryPlanProjection["stage"], { eyebrow: string; title: string }> = {
  intake: { eyebrow: "Recovery plan", title: "We’re building your recovery plan" },
  crisis_recovery: { eyebrow: "Recovery first", title: "Protect stability first" },
  stability: { eyebrow: "Stability", title: "Stabilise before another application" },
  rebuilding: { eyebrow: "Rebuilding", title: "Rebuild the evidence that matters" },
  optimisation: { eyebrow: "Optimisation", title: "Fine-tune before you check again" },
  ready_to_check: { eyebrow: "Ready to check", title: "You may be ready to check eligibility" },
};

function formatReassessment(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function RecoveryStatus({
  plan,
  origin,
}: {
  plan: RecoveryPlanProjection;
  origin: "direct" | "partner";
}) {
  const stage = STAGE_COPY[plan.stage];
  const reassessment = formatReassessment(plan.nextReassessmentAt);

  return (
    <section className="cq-panel mb-4 rounded-[1.75rem] p-5" aria-label="Decline recovery plan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{stage.eyebrow}</p>
          <h2 className="mt-2 text-xl font-black text-white">{stage.title}</h2>
        </div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-violet-200">
          {origin === "partner" ? "Partner handoff reviewed" : "Direct recovery"}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Next safe move</p>
        <p className="mt-1.5 text-base font-black text-white">{plan.nextSafeAction.title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          This comes from your current Credit Quest evidence, safety and readiness — not from a lender’s decline reason.
        </p>
      </div>

      {plan.evidenceGaps.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Evidence to improve or confirm</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
            {plan.evidenceGaps.slice(0, 3).map((gap) => (
              <li key={gap} className="flex gap-2">
                <span aria-hidden="true" className="text-lime-300">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
        {reassessment
          ? `Next evidence-based reassessment: ${reassessment}.`
          : "No reassessment date is being invented. Credit Quest will only show one when real dated evidence supports it."}
      </p>
    </section>
  );
}

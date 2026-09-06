import type { RecoveryExperienceProjection } from "@/lib/recovery/experience";

function copyFor(projection: RecoveryExperienceProjection): { title: string; body: string } {
  switch (projection.state) {
    case "action_required":
      return {
        title: "Complete your current priority quest.",
        body: "Credit Quest will reassess using the same independent guidance when your information or genuine review timing changes.",
      };
    case "waiting_for_evidence":
      return {
        title: "We’re waiting for evidence.",
        body: "Your action has not reached its genuine review point yet. There is nothing useful to repeat or reapply for right now.",
      };
    case "reassessment_due":
      return {
        title: "Your evidence-based review point has arrived.",
        body: "Credit Quest can now reassess the same profile, safety and readiness evidence to see what has genuinely changed.",
      };
    case "not_ready":
      return {
        title: "Keep building before another eligibility check.",
        body: projection.summary,
      };
    case "ready_to_check":
      return {
        title: "You’re ready to check eligibility again.",
        body: "This is not a guarantee of acceptance. Any lender still makes its own eligibility, affordability and lending decision.",
      };
  }
}

export function RecoveryNextCard({ projection }: { projection: RecoveryExperienceProjection }) {
  const copy = copyFor(projection);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">What happens next</p>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{copy.title}</h2>
      <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">{copy.body}</p>
      {projection.returnState.status === "available" && projection.returnState.partnerLabel ? (
        <p className="mt-5 rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-sm font-semibold leading-6 text-slate-400">
          An optional return route may be available after Credit Quest’s server-side checks. You stay in control of whether to use it.
        </p>
      ) : null}
    </div>
  );
}

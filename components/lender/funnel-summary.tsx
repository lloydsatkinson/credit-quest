import type { LenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";

function value(value: number | null): string {
  return value === null ? "Unavailable" : value.toLocaleString("en-GB");
}

export function FunnelSummary({ analytics }: { analytics: LenderPilotAnalytics }) {
  const stages = [
    ["Handoffs", analytics.totals.handoffs],
    ["Activated", analytics.totals.activated],
    ["Started Recovery", analytics.totals.startedRecovery],
    ["Reassessed", analytics.totals.reassessed],
    ["Ready to Check", analytics.totals.readyToCheck],
    ["Voluntary Return", analytics.totals.voluntaryReturns],
  ] as const;

  return (
    <section aria-labelledby="recovery-funnel-heading">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Governed recovery funnel</p>
        <h2 id="recovery-funnel-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">
          Recovery progress
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map(([label, stageValue]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value(stageValue)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Ready to Check is a historical Credit Quest recovery milestone. It is not a lending decision.
      </p>
    </section>
  );
}

import { requireAdminUser } from "@/lib/server/admin-auth";
import { getRecoveryAnalytics } from "@/lib/server/recovery-analytics-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function Metric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value === null ? "Unavailable" : value}</p>
    </div>
  );
}

export default async function RecoveryAnalyticsPage() {
  await requireAdminUser();
  const result = await getRecoveryAnalytics(createAdminSupabaseClient(), { windowDays: 30 });

  if (!result.available) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Recovery analytics</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Reporting source unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">No zeroes are substituted when the underlying recovery data cannot be read.</p>
      </section>
    );
  }

  const suppressionEntries = Object.entries(result.suppressionReasons)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Closed-loop recovery · {result.windowDays} days</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Recovery funnel</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Aggregate operational reporting only. Customer identifiers, Support Needs, vulnerability detail and partner economics are deliberately excluded from this view.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Partner handoffs" value={result.totals.handoffs} />
        <Metric label="Activations" value={result.totals.activations} />
        <Metric label="First recovery actions" value={result.totals.firstActions} />
        <Metric label="Reassessments" value={result.totals.reassessments} />
        <Metric label="Ready to check" value={result.totals.readyToCheck} />
        <Metric label="Voluntary returns" value={result.totals.voluntaryReturns} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-black text-slate-950">Time to first recovery action</h3>
          <p className="mt-3 text-3xl font-black text-violet-700">
            {result.averageTimeToFirstActionHours === null
              ? "Unavailable"
              : `${result.averageTimeToFirstActionHours}h`}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Action source: <strong>{result.sources.actions}</strong>. Missing telemetry is never presented as zero activity.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-black text-slate-950">Recorded suppression reasons</h3>
          {suppressionEntries.length ? (
            <div className="mt-4 grid gap-2">
              {suppressionEntries.map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-bold text-slate-700">{reason}</span>
                  <span className="font-black text-slate-950">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No recorded suppression outcomes in this window.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-black text-slate-950">Partner cohorts</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-3 pr-4">Partner</th>
                <th className="pb-3 pr-4">Handoffs</th>
                <th className="pb-3 pr-4">Activations</th>
                <th className="pb-3 pr-4">Ready to check</th>
                <th className="pb-3">Voluntary returns</th>
              </tr>
            </thead>
            <tbody>
              {result.partners.map((partner) => (
                <tr key={partner.partnerId} className="border-t border-slate-100">
                  <td className="py-3 pr-4 font-bold text-slate-950">{partner.partnerDisplayName}</td>
                  <td className="py-3 pr-4">{partner.handoffs}</td>
                  <td className="py-3 pr-4">{partner.activations}</td>
                  <td className="py-3 pr-4">{partner.readyToCheck}</td>
                  <td className="py-3">{partner.voluntaryReturns}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.partners.length ? <p className="py-4 text-sm text-slate-600">No partner handoffs in this window.</p> : null}
        </div>
      </section>
    </div>
  );
}

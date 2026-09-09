import { FunnelSummary } from "@/components/lender/funnel-summary";
import { getLenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";
import { requireLenderUser } from "@/lib/server/lender-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function LenderOverviewPage() {
  const identity = await requireLenderUser();
  const result = await getLenderPilotAnalytics(createAdminSupabaseClient(), identity);

  if (!result.available) {
    return <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-900">Recovery reporting is currently unavailable.</p>;
  }

  const analytics = result.analytics;
  return (
    <div className="space-y-8">
      <FunnelSummary analytics={analytics} />
      <section aria-labelledby="timing-heading" className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="timing-heading" className="text-lg font-black text-slate-950">Median time to first action</h2>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {analytics.medianTimeToFirstActionHours === null ? "Unavailable" : `${analytics.medianTimeToFirstActionHours} hours`}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Median time to Ready to Check</h2>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {analytics.medianTimeToReadyDays === null ? "Unavailable" : `${analytics.medianTimeToReadyDays} days`}
          </p>
        </div>
      </section>
      <p className="text-sm font-medium text-slate-500">
        Credit Quest reports recovery milestones and customer-controlled returns. It does not report lending outcomes or probabilities.
      </p>
    </div>
  );
}

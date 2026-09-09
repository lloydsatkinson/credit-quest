import { DeclinePerformanceTable } from "@/components/lender/decline-performance-table";
import { getLenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";
import { requireLenderUser } from "@/lib/server/lender-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function LenderDeclinesPage() {
  const identity = await requireLenderUser();
  const result = await getLenderPilotAnalytics(createAdminSupabaseClient(), identity);

  return (
    <section aria-labelledby="declines-heading" className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Aggregate only</p>
        <h2 id="declines-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Decline intelligence</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Canonical Credit Quest decline categories and cohort-level recovery progress. Customer-level records are not exposed here.</p>
      </div>
      {result.available
        ? <DeclinePerformanceTable reasons={result.analytics.declineReasons} />
        : <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-900">Decline intelligence is currently unavailable.</p>}
    </section>
  );
}

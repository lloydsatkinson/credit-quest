import { getLenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";
import { requireLenderUser } from "@/lib/server/lender-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function LenderReturnsPage() {
  const identity = await requireLenderUser();
  const result = await getLenderPilotAnalytics(createAdminSupabaseClient(), identity);

  if (!result.available) {
    return <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-900">Return outcomes are currently unavailable.</p>;
  }

  const { returnOutcomes } = result.analytics;
  return (
    <section aria-labelledby="returns-heading" className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Customer controlled</p>
        <h2 id="returns-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Return outcomes</h2>
        <p className="mt-2 text-sm text-slate-600">A Ready to Check milestone can exist independently of whether any route is available.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Original product voluntary return</h3>
          <p className="mt-2 text-3xl font-black text-slate-950">{returnOutcomes.originalProductReturns}</p>
          <p className="mt-2 text-sm text-slate-600">Customers who explicitly chose to continue to the original lender route after Credit Quest gates passed.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Alternative eligibility checks</h3>
          <p className="mt-2 text-3xl font-black text-slate-950">{returnOutcomes.alternativeRouteChecks}</p>
          <p className="mt-2 text-sm text-slate-600">Customer-selected checks for another option after all independent Credit Quest safety and readiness gates passed.</p>
        </article>
      </div>
    </section>
  );
}

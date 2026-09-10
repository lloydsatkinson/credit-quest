import { getLenderPilotAnalytics, getLenderPilotContext } from "@/lib/server/lender-analytics-repository";
import { requireLenderUser } from "@/lib/server/lender-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function labelProduct(value: string | null): string {
  return value ? value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()) : "All products";
}

export default async function LenderCohortsPage() {
  const identity = await requireLenderUser();
  const admin = createAdminSupabaseClient();
  const context = await getLenderPilotContext(admin, identity);
  const fullScope = await getLenderPilotAnalytics(admin, identity);
  void fullScope;

  const rows = await Promise.all(context.map(async (pilot) => ({
    pilot,
    result: await getLenderPilotAnalytics(admin, { partnerId: identity.partnerId, pilotIds: [pilot.id] }),
  })));

  return (
    <section aria-labelledby="cohorts-heading" className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Authorised cohorts</p>
        <h2 id="cohorts-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Cohort comparison</h2>
        <p className="mt-2 text-sm text-slate-600">Compare pilot batches and product families using aggregate recovery milestones only.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-black">Cohort</th>
              <th className="px-4 py-3 font-black">Product</th>
              <th className="px-4 py-3 text-right font-black">Handoffs</th>
              <th className="px-4 py-3 text-right font-black">Activated</th>
              <th className="px-4 py-3 text-right font-black">Ready to Check</th>
              <th className="px-4 py-3 text-right font-black">Voluntary Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ pilot, result }) => (
              <tr key={pilot.id}>
                <td className="px-4 py-3 font-bold text-slate-950">{pilot.displayName}</td>
                <td className="px-4 py-3 text-slate-600">{labelProduct(pilot.productCategory)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{result.available ? result.analytics.totals.handoffs : "Unavailable"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{result.available ? result.analytics.totals.activated : "Unavailable"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{result.available ? result.analytics.totals.readyToCheck : "Unavailable"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{result.available ? result.analytics.totals.voluntaryReturns : "Unavailable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p role="status" className="text-sm font-semibold text-slate-600">No authorised cohort context is currently available.</p> : null}
    </section>
  );
}

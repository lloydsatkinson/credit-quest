import { MetricsDashboard } from "@/components/admin/metrics-dashboard";
import { getV22Metrics } from "@/lib/server/metrics-repository";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdminUser();
  const metrics = await getV22Metrics(createAdminSupabaseClient(), { windowDays: 30 }).catch(
    () => ({ available: false as const, reason: "unavailable" as const }),
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">Dark-first controls</h2><p className="mt-2 text-sm leading-6 text-slate-600">Commercial and email runtime switches are explicit, auditable and separate from Credit Quest guidance.</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">Hard safety boundaries</h2><p className="mt-2 text-sm leading-6 text-slate-600">Age, Safe Mode, evidence and readiness gates are server-owned and cannot be edited here.</p></div>
      </section>
      <MetricsDashboard result={metrics} />
    </div>
  );
}

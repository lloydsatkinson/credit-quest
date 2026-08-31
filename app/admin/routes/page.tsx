import { RouteForm } from "@/components/admin/route-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listAdminCommercialRoutes, listCommercialPartners } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminRoutesPage() {
  await requireAdminUser();
  const admin = createAdminSupabaseClient();
  const [routes, partners] = await Promise.all([
    listAdminCommercialRoutes(admin),
    listCommercialPartners(admin),
  ]);
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <RouteForm partners={partners.map((partner) => ({ id: String(partner.id), label: String(partner.display_name) }))} />
      <div className="space-y-3">
        <h2 className="text-xl font-black">Routes</h2>
        {routes.map((route) => (
          <article key={String(route.id)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-black">{String(route.route_key)}</p>
            <p className="text-sm text-slate-500">{String(route.environment)} · {String(route.destination_url)}</p>
            <p className="mt-2 text-xs font-bold text-slate-600">enabled={String(route.enabled)} · min_age={String(route.min_age)} · readiness={String(route.required_readiness)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

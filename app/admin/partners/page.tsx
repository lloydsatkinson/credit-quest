import { PartnerForm } from "@/components/admin/partner-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listCommercialPartners } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminPartnersPage() {
  await requireAdminUser();
  const partners = await listCommercialPartners(createAdminSupabaseClient());
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <PartnerForm />
      <div className="space-y-3">
        <h2 className="text-xl font-black">Partners</h2>
        {partners.map((partner) => (
          <article key={String(partner.id)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-black">{String(partner.display_name)}</p>
            <p className="text-sm text-slate-500">{String(partner.partner_key)}</p>
            <p className="mt-2 text-xs font-bold text-slate-600">enabled={String(partner.enabled)} · sandbox={String(partner.sandbox_enabled)} · live={String(partner.live_enabled)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

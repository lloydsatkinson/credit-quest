import { DisclosurePublishForm } from "@/components/admin/disclosure-publish-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listCommercialDisclosures } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminDisclosuresPage() {
  await requireAdminUser();
  const disclosures = await listCommercialDisclosures(createAdminSupabaseClient());
  return (
    <section className="space-y-4">
      <div><h2 className="text-xl font-black">Disclosures</h2><p className="mt-1 text-sm text-slate-600">Only reviewed versions can be published, and publication is audited atomically.</p></div>
      {disclosures.map((item) => (
        <article key={String(item.id)} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-black">{String(item.disclosure_key)} · v{String(item.version)}</p><p className="text-xs font-bold uppercase text-slate-500">{String(item.status)}</p></div>
            {item.status === "reviewed" ? <DisclosurePublishForm disclosureId={String(item.id)} /> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{String(item.body)}</p>
        </article>
      ))}
    </section>
  );
}

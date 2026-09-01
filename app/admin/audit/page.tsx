import { requireAdminUser } from "@/lib/server/admin-auth";
import { listAdminAudit } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminAuditPage() {
  await requireAdminUser();
  const events = await listAdminAudit(createAdminSupabaseClient(), 100);
  return (
    <section className="space-y-4">
      <div><h2 className="text-xl font-black">Admin audit</h2><p className="mt-1 text-sm text-slate-600">Recent control-plane mutations. This view is read-only.</p></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b bg-slate-50"><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Admin</th></tr></thead>
          <tbody>{events.map((event) => (
            <tr key={String(event.id)} className="border-b last:border-0"><td className="p-3">{String(event.occurred_at)}</td><td className="p-3 font-bold">{String(event.action)}</td><td className="p-3">{String(event.entity_type)}</td><td className="p-3 font-mono text-xs">{String(event.admin_user_id ?? "deleted-user")}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

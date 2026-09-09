import { RecoverySimulatorForm } from "@/components/admin/recovery-simulator-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listDeclinePartnersForPolicyAdmin } from "@/lib/server/decline-policy-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function RecoverySimulatorPage() {
  await requireAdminUser();
  const partners = await listDeclinePartnersForPolicyAdmin(createAdminSupabaseClient());
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">V2.3 Simulator</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Production-equivalent recovery preview</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Uses the same canonical mapping, barrier precedence and controlled condition language as production. Simulation never changes customer readiness or creates a customer journey.</p>
        <a href="/admin/recovery/policies" className="mt-3 inline-block text-sm font-black text-violet-700">← Recovery policies</a>
      </section>
      <RecoverySimulatorForm partners={partners.map((partner) => ({ id: partner.id, displayName: partner.displayName }))} />
    </div>
  );
}

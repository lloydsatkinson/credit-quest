import { RecoveryPolicyForm } from "@/components/admin/recovery-policy-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  listDeclinePartnersForPolicyAdmin,
  listRecoveryPolicyAdminRows,
} from "@/lib/server/decline-policy-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function RecoveryPoliciesPage() {
  await requireAdminUser();
  const admin = createAdminSupabaseClient();
  const [partners, rows] = await Promise.all([
    listDeclinePartnersForPolicyAdmin(admin),
    listRecoveryPolicyAdminRows(admin),
  ]);

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">V2.3 Journey Builder</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Recovery policy versions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Map lender decline codes into the governed Credit Quest taxonomy, configure customer-safe recovery wording and phase steps, then validate before publishing. Published versions are immutable.</p>
      </section>
      <RecoveryPolicyForm partners={partners.map((partner) => ({ id: partner.id, displayName: partner.displayName }))} rows={rows} />
    </div>
  );
}

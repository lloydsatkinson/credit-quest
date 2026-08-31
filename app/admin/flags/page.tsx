import { FlagForm } from "@/components/admin/flag-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listFeatureFlags } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminFlagsPage() {
  await requireAdminUser();
  const flags = await listFeatureFlags(createAdminSupabaseClient());
  return (
    <section className="space-y-4">
      <div><h2 className="text-xl font-black">Runtime flags</h2><p className="mt-1 text-sm text-slate-600">These switches do not override age, Safe Mode, evidence or readiness gates. Live referrals have a separate server lock.</p></div>
      {flags.map((flag) => (
        <FlagForm
          key={String(flag.flag_key)}
          flagKey={flag.flag_key as "email_reminders_enabled" | "commercial_gateway_enabled"}
          enabled={flag.enabled === true}
        />
      ))}
    </section>
  );
}

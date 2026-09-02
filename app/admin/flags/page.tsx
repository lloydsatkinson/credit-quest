import { FlagForm } from "@/components/admin/flag-form";
import { SandboxPilotForm } from "@/components/admin/sandbox-pilot-form";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { listFeatureFlags } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export default async function AdminFlagsPage() {
  await requireAdminUser();
  const flags = await listFeatureFlags(createAdminSupabaseClient());
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black">Runtime flags</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sandbox and live commercial controls are separate. Neither overrides age, Safe Mode, evidence or readiness gates. Live referrals also require the independent server environment lock.
        </p>
      </div>
      {flags.map((flag) => (
        <FlagForm
          key={String(flag.flag_key)}
          flagKey={flag.flag_key as "email_reminders_enabled" | "commercial_gateway_enabled" | "commercial_sandbox_enabled"}
          enabled={flag.enabled === true}
        />
      ))}
      <div className="pt-3">
        <h3 className="text-lg font-black">Internal sandbox access</h3>
        <p className="mt-1 mb-3 text-sm text-slate-600">
          Sandbox access also requires explicit pilot membership. Membership alone cannot activate the sandbox and never bypasses age, Safe Mode, evidence or green-readiness checks. Live routing is unaffected.
        </p>
        <SandboxPilotForm />
      </div>
    </section>
  );
}

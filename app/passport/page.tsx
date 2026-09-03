import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer/customer-shell";
import { DemoCreditGuidance } from "@/components/guidance/demo-credit-guidance";
import { PassportDetail } from "@/components/passport/passport-detail";
import { rankMissionInstances } from "@/lib/domain/mission-engine";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { listMissionInstances } from "@/lib/server/mission-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function PassportShell({ children }: { children: ReactNode }) {
  return (
    <CustomerShell active="passport">
      <main data-testid="passport-shell" className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="cq-kicker">Progress view</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Evidence changes this view — game points do not.</p>
          </div>
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            Guidance, not underwriting
          </span>
        </header>
        {children}
      </main>
    </CustomerShell>
  );
}

export default async function PassportPage() {
  if (!getSupabasePublicEnv()) {
    return (
      <PassportShell>
        <DemoCreditGuidance view="passport" />
      </PassportShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fpassport");

  const guidance = await getCreditGuidanceForUser(supabase, user.id);
  if (!guidance) redirect("/onboarding");

  const now = new Date();
  const instances = await listMissionInstances(supabase, user.id);
  const availableMissions = rankMissionInstances(guidance.profile, instances, [], now);
  const electoralRollMission = availableMissions.find(
    (item) => item.mission.slug === "register-electoral-roll",
  );

  return (
    <PassportShell>
      <PassportDetail
        passport={guidance.passport}
        actionHrefs={electoralRollMission
          ? { identity: `/actions/${electoralRollMission.instance.id}` }
          : undefined}
      />
    </PassportShell>
  );
}

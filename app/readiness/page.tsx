import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer/customer-shell";
import { DemoCreditGuidance } from "@/components/guidance/demo-credit-guidance";
import { ReadinessDetail } from "@/components/readiness/readiness-detail";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function ReadinessShell({ children }: { children: ReactNode }) {
  return (
    <CustomerShell active="readiness">
      <main data-testid="readiness-shell" className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="cq-kicker">Eligibility first</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Readiness is evidence-led, never earned with XP.</p>
          </div>
          <span className="rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">
            No approval claim
          </span>
        </header>
        {children}
      </main>
    </CustomerShell>
  );
}

export default async function ReadinessPage() {
  if (!getSupabasePublicEnv()) {
    return (
      <ReadinessShell>
        <DemoCreditGuidance view="readiness" />
      </ReadinessShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Freadiness");

  const guidance = await getCreditGuidanceForUser(supabase, user.id);
  if (!guidance) redirect("/onboarding");

  return (
    <ReadinessShell>
      <ReadinessDetail readiness={guidance.readiness} />
    </ReadinessShell>
  );
}

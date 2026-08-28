import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoCreditGuidance } from "@/components/guidance/demo-credit-guidance";
import { PassportDetail } from "@/components/passport/passport-detail";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function PassportShell({ children }: { children: ReactNode }) {
  return (
    <main data-testid="passport-shell" className="mx-auto min-h-screen max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-black text-violet-700">← Quest Feed</Link>
        <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm backdrop-blur">
          Guidance, not underwriting
        </span>
      </header>
      {children}
    </main>
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

  return (
    <PassportShell>
      <PassportDetail passport={guidance.passport} />
    </PassportShell>
  );
}

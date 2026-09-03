import type { Metadata } from "next";
import Link from "next/link";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PartnerContextReview } from "@/components/recovery/partner-context-review";
import { previewPartnerHandoff } from "@/lib/server/partner-intake-service";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review decline handoff | Credit Quest",
  robots: { index: false, follow: false },
};

function UnusableHandoff() {
  return (
    <CustomerShell active="profile">
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="cq-panel rounded-[2rem] p-6 sm:p-8">
          <span className="rounded-full border border-slate-300/10 bg-white/[0.03] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Secure handoff
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">This handoff link can’t be used</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            It may have expired, already been used, or the partner connection may no longer be available. Nothing from this link has been added to your Credit Quest plan.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            You can still tell Credit Quest about a decline yourself. That keeps you in control and does not rely on partner-supplied context.
          </p>
          <Link
            href="/recovery"
            className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Start recovery directly
          </Link>
        </section>
      </main>
    </CustomerShell>
  );
}

export default async function PartnerHandoffPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!getSupabasePublicEnv()) return <UnusableHandoff />;

  let context = null;
  try {
    context = await previewPartnerHandoff(token, new Date());
  } catch {
    return <UnusableHandoff />;
  }
  if (!context) return <UnusableHandoff />;

  return (
    <CustomerShell active="profile">
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-5">
          <p className="cq-kicker">Decline recovery</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Review first. Save only what you agree with.</p>
        </header>
        <PartnerContextReview token={token} context={context} />
      </main>
    </CustomerShell>
  );
}

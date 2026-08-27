import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountsClient } from "@/components/accounts/accounts-client";
import type { ProviderDefinition, UserAccount } from "@/lib/domain/types";
import { listUserAccounts } from "@/lib/server/account-repository";
import { listAccountProviders } from "@/lib/server/action-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AccountsPage() {
  let accounts: UserAccount[] = [];
  let providers: ProviderDefinition[] = [];

  if (getSupabasePublicEnv()) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Faccounts");
    [accounts, providers] = await Promise.all([
      listUserAccounts(supabase, user.id),
      listAccountProviders(supabase),
    ]);
  }

  return (
    <main
      data-testid="accounts-shell"
      className="accounts-shell mx-auto min-h-screen max-w-3xl px-5 py-6 sm:px-8 sm:py-10"
    >
      <header className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-black text-violet-700">← Quest Feed</Link>
        <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm backdrop-blur">
          Manual now · Open Banking ready later
        </span>
      </header>

      <section className="mt-8 overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-violet-200/40 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
            Minimum data
          </span>
          <span className="text-xs font-bold text-slate-500">You stay in control</span>
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">My accounts</h1>
        <p className="mt-3 text-lg font-semibold text-slate-200">Only the details that help your plan.</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Credit Quest uses a lightweight account record to target card-specific missions such as utilisation or direct-debit protection. Never enter passwords or a full card number.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Last 4 only", "Enough to recognise the account"],
            ["Balance + limit", "Used only when they improve guidance"],
            ["Direct debit", "Helps protect payment missions"],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <AccountsClient initialAccounts={accounts} providers={providers} />
      </div>
    </main>
  );
}

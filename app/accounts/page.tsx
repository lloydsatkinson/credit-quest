import { redirect } from "next/navigation";
import { AccountsClient } from "@/components/accounts/accounts-client";
import { CustomerShell } from "@/components/customer/customer-shell";
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
    <CustomerShell active="profile">
      <main
        data-testid="accounts-shell"
        className="accounts-shell mx-auto min-h-screen max-w-3xl px-5 py-7 sm:px-8 sm:py-10"
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="cq-kicker">Profile evidence</p>
            <p className="mt-1 text-xs font-bold text-slate-500">Only the details that help your plan.</p>
          </div>
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
            Manual now · connected later
          </span>
        </header>

        <section className="cq-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div className="absolute -right-20 -top-24 size-60 rounded-full bg-lime-300/[0.045] blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-lime-300">
                Minimum data
              </span>
              <span className="text-xs font-bold text-slate-500">You stay in control</span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">My accounts</h1>
            <p className="mt-3 text-lg font-semibold text-slate-200">Give missions the right account context.</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Credit Quest uses a lightweight account record to target card-specific missions such as utilisation or direct-debit protection. Never enter passwords or a full card number.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Last 4 only", "Enough to recognise the account", "text-cyan-300"],
                ["Balance + limit", "Used only when they improve guidance", "text-fuchsia-300"],
                ["Direct debit", "Helps protect payment missions", "text-lime-300"],
              ].map(([title, copy, accent]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className={`text-sm font-black ${accent}`}>{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6">
          <AccountsClient initialAccounts={accounts} providers={providers} />
        </div>
      </main>
    </CustomerShell>
  );
}

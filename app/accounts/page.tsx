import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountsClient } from "@/components/accounts/accounts-client";
import { listUserAccounts } from "@/lib/server/account-repository";
import { listProviders } from "@/lib/server/action-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AccountsPage() {
  let accounts = [];
  let providers = [];

  if (getSupabasePublicEnv()) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Faccounts");
    [accounts, providers] = await Promise.all([
      listUserAccounts(supabase, user.id),
      listProviders(supabase),
    ]);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="font-black text-violet-700">← Dashboard</Link>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Manual now, Open Banking ready later</span>
      </header>
      <h1 className="mt-10 text-4xl font-black tracking-tight">My accounts</h1>
      <p className="mt-3 mb-8 leading-7 text-slate-600">
        Add the credit accounts Credit Quest needs to target card-specific missions. We store only the minimum account details you choose to provide; never enter passwords or a full card number.
      </p>
      <AccountsClient initialAccounts={accounts} providers={providers} />
    </main>
  );
}

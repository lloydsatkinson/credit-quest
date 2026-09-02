import Link from "next/link";
import { redirect } from "next/navigation";
import { CommercialGatewayCard } from "@/components/commercial/commercial-gateway-card";
import { CustomerShell } from "@/components/customer/customer-shell";
import { OffersClient } from "@/components/offers/offers-client";
import { listPermittedCommercialRoutes } from "@/lib/server/commercial-gateway";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OffersPage() {
  let content: React.ReactNode;

  if (!getSupabasePublicEnv()) {
    content = <OffersClient />;
  } else {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=%2Foffers");

    const routes = await listPermittedCommercialRoutes({
      userId: user.id,
      environment: "sandbox",
      now: new Date(),
    }).catch(() => []);

    content = routes.length > 0 ? (
      <div className="grid gap-4">
        {routes.map(({ route, disclosure }) => (
          <CommercialGatewayCard
            key={route.id}
            route={{
              id: route.id,
              routeKey: route.routeKey,
              partnerDisplayName: route.partnerDisplayName,
              disclosure: {
                id: disclosure.id,
                body: disclosure.body,
              },
            }}
          />
        ))}
      </div>
    ) : (
      <section className="cq-panel rounded-3xl p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.17em] text-lime-300">A good outcome can be no product</p>
        <h2 className="mt-3 text-2xl font-black text-white">No product step is available from Credit Quest right now.</h2>
        <p className="mt-3 leading-7 text-slate-400">
          Your plan can continue without a product referral. Credit Quest only shows a route after the current safety, age, evidence and readiness checks all allow it.
        </p>
        <Link href="/learn" className="mt-5 inline-flex rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] px-4 py-3 text-sm font-black text-cyan-200">
          Visit Credit Quest Academy
        </Link>
      </section>
    );
  }

  return (
    <CustomerShell>
      <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="font-black text-cyan-300">← Quest Feed</Link>
          <span className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Optional · downstream only</span>
        </header>
        <p className="cq-kicker mt-10">Commercial gateway</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">Explore relevant options</h1>
        <p className="mb-8 mt-3 leading-7 text-slate-400">
          Product routes never determine your next-best mission. Credit Quest applies safety and readiness first, and any available sandbox route is shown only afterwards.
        </p>
        {content}
      </main>
    </CustomerShell>
  );
}

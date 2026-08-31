import Link from "next/link";
import { redirect } from "next/navigation";
import { CommercialGatewayCard } from "@/components/commercial/commercial-gateway-card";
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">No product step is available from Credit Quest right now.</h2>
        <p className="mt-3 leading-7 text-slate-600">
          Your plan can continue without a product referral. Credit Quest only shows a route after the current safety, age, evidence and readiness checks all allow it.
        </p>
        <Link href="/learn" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
          Visit Credit Quest Academy
        </Link>
      </section>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="font-black text-violet-700">← Dashboard</Link>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Optional marketplace</span>
      </header>
      <h1 className="mt-10 text-4xl font-black tracking-tight">Explore relevant options</h1>
      <p className="mb-8 mt-3 leading-7 text-slate-600">
        Product routes never determine your next-best mission. Credit Quest applies safety and readiness first, and any available sandbox route is shown only afterwards.
      </p>
      {content}
    </main>
  );
}

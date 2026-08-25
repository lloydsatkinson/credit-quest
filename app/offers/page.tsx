import Link from "next/link";
import { OffersClient } from "@/components/offers/offers-client";

export default function OffersPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between"><Link href="/dashboard" className="font-black text-violet-700">← Dashboard</Link><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Optional marketplace</span></header>
      <h1 className="mt-10 text-4xl font-black tracking-tight">Explore relevant options</h1>
      <p className="mt-3 mb-8 leading-7 text-slate-600">These products never determine your next-best mission. Partner relationships are disclosed, and providers make all eligibility and lending decisions.</p>
      <OffersClient />
    </main>
  );
}

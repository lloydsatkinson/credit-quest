"use client";

import Link from "next/link";
import type { OfferDefinition } from "@/lib/domain/types";

export function OfferCard({ offer }: { offer: OfferDefinition }) {
  return (
    <article data-testid={`offer-card-${offer.id}`} className="cq-panel rounded-3xl p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="cq-kicker">Credit-builder example</p>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Demo only</span>
      </div>
      <h2 className="mt-3 text-xl font-black text-white">{offer.productName}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">{offer.provider}</p>
      <p className="mt-4 text-sm leading-6 text-slate-400">
        This example can help explain what a future product step might look like. It does not represent a Credit Quest eligibility decision or approval prediction.
      </p>
      <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.055] p-3 text-xs leading-5 text-amber-100">{offer.disclosure}</p>
      <p className="mt-4 text-sm font-black text-slate-300">Demo only — no application is sent.</p>
      <Link
        href="/learn/credit-quest-readiness"
        className="mt-5 inline-flex w-full justify-center rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950 shadow-[0_10px_32px_rgba(31,228,255,0.12)] transition hover:bg-cyan-200"
      >
        Review readiness guidance
      </Link>
    </article>
  );
}

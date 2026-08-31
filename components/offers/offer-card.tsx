"use client";

import Link from "next/link";
import type { OfferDefinition } from "@/lib/domain/types";

export function OfferCard({ offer }: { offer: OfferDefinition }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-violet-600">Credit-builder example</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Demo only</span>
      </div>
      <h2 className="mt-2 text-xl font-black">{offer.productName}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">{offer.provider}</p>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        This example can help explain what a future product step might look like. It does not represent a Credit Quest eligibility decision or approval prediction.
      </p>
      <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{offer.disclosure}</p>
      <p className="mt-4 text-sm font-black text-slate-700">Demo only — no application is sent.</p>
      <Link
        href="/learn/credit-quest-readiness"
        className="mt-5 inline-flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3 font-black text-white"
      >
        Review readiness guidance
      </Link>
    </article>
  );
}

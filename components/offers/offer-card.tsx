"use client";

import type { OfferDefinition } from "@/lib/domain/types";
import { trackEvent } from "@/lib/events";

export function OfferCard({ offer }: { offer: OfferDefinition }) {
  async function openProvider() {
    await trackEvent("offer_clicked", { offerId: offer.id, provider: offer.provider });
    window.location.assign(offer.affiliateUrl);
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wider text-violet-600">Credit-builder option</p>
      <h2 className="mt-2 text-xl font-black">{offer.productName}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">{offer.provider}</p>
      <p className="mt-4 text-sm leading-6 text-slate-600">May suit adults looking to establish revolving credit history. The provider decides eligibility, approval, pricing and limits.</p>
      <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{offer.disclosure}</p>
      <button onClick={openProvider} className="mt-5 w-full rounded-2xl bg-violet-600 px-4 py-3 font-black text-white">Check eligibility with provider</button>
    </article>
  );
}

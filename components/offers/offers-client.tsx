"use client";

import { useEffect, useState } from "react";
import { OfferCard } from "@/components/offers/offer-card";
import { getMarketplaceOffers } from "@/lib/domain/offer-matcher";
import { getAgeMode } from "@/lib/domain/age-gate";
import type { CreditProfile } from "@/lib/domain/types";

const fallback: CreditProfile = {
  userId: "demo-user", dateOfBirth: "1995-04-12", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: true, utilisationPct: null, missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0, hasRevolvingCredit: false, hasDirectDebitForCredit: false,
};

export function OffersClient() {
  const [profile, setProfile] = useState(fallback);
  useEffect(() => {
    const saved = localStorage.getItem("creditquest-profile");
    if (saved) try { setProfile(JSON.parse(saved)); } catch { /* keep fallback */ }
  }, []);

  const mode = getAgeMode(profile.dateOfBirth);
  const offers = getMarketplaceOffers(profile);

  if (mode === "education") {
    return <section className="rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-2xl font-black">Learn now. Products can wait.</h2><p className="mt-3 leading-7 text-slate-600">Credit Quest education mode is designed to help you understand credit before you are old enough for credit-product referrals. We do not show card links to under-18s.</p></section>;
  }

  return <div className="grid gap-4">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>;
}

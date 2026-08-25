"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import { getNextBestMission } from "@/lib/domain/mission-engine";
import { getOffersForMission } from "@/lib/domain/offer-matcher";
import type { CreditProfile } from "@/lib/domain/types";

const demoProfile: CreditProfile = {
  userId: "demo-user",
  dateOfBirth: "1995-04-12",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: false,
  utilisationPct: 62,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 1,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: false,
};

export function DashboardClient() {
  const [profile, setProfile] = useState<CreditProfile>(demoProfile);
  const [completed, setCompleted] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("creditquest-profile");
    const savedCompleted = localStorage.getItem("creditquest-completed");
    if (saved) {
      try { setProfile(JSON.parse(saved)); } catch { /* keep demo profile */ }
    }
    if (savedCompleted) setCompleted(Number(savedCompleted) || 0);
  }, []);

  const result = useMemo(() => {
    try {
      const score = calculateQuestScore(profile);
      const rankedMission = getNextBestMission(profile);
      const offers = rankedMission ? getOffersForMission(profile, rankedMission.mission) : [];
      return { score, rankedMission, offers };
    } catch {
      return { score: { score: 0, factors: [] }, rankedMission: null, offers: [] };
    }
  }, [profile]);

  function startMission() {
    setStarted(true);
    const next = completed + 1;
    setCompleted(next);
    localStorage.setItem("creditquest-completed", String(next));
  }

  const stage = result.rankedMission?.mission.stage ?? "maintain";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between"><Link href="/" className="font-black text-violet-700">Credit Quest</Link><Link href="/offers" className="text-sm font-bold text-slate-600">Offers</Link></header>
      <p className="text-sm font-black uppercase tracking-widest text-violet-600">Your next best move</p>
      {result.rankedMission ? <div className="mt-3"><NextMissionCard rankedMission={result.rankedMission} offer={result.offers[0]} reviewTiming="Review again in around 30 days" onStart={startMission} /></div> : <div className="mt-3 rounded-3xl bg-white p-6 shadow"><h2 className="text-2xl font-black">You&apos;re up to date for now.</h2><p className="mt-2 text-slate-600">Review your profile or check back after your next review date.</p></div>}
      {started && <div role="status" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Mission started — your progress has been updated.</div>}
      <div className="mt-5"><ProgressStrip score={result.score.score} stage={stage} completed={completed} nextReview="30 days" /></div>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="font-black">Your journey</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">Setup → Stabilise → Build → Optimise → Maintain</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and does not predict whether a lender will approve an application.</p>
      </section>
    </main>
  );
}

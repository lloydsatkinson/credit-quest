"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { completeMission, startMission } from "@/lib/domain/mission-lifecycle";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import { getNextBestMission } from "@/lib/domain/mission-engine";
import { getOffersForMission } from "@/lib/domain/offer-matcher";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile, MissionProgress, MissionProgressMap } from "@/lib/domain/types";

const DEMO_PROGRESS_KEY = "creditquest-mission-progress";
const PROFILE_KEY = "creditquest-profile";

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
  const [progress, setProgress] = useState<MissionProgressMap>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    const savedProgress = localStorage.getItem(DEMO_PROGRESS_KEY);
    const timer = window.setTimeout(() => {
      if (savedProfile) {
        try { setProfile(JSON.parse(savedProfile)); } catch { /* keep demo profile */ }
      }
      if (savedProgress) {
        try { setProgress(JSON.parse(savedProgress)); } catch { /* keep empty progress */ }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const result = useMemo(() => {
    try {
      const score = calculateQuestScore(profile);
      const safety = assessSafety(profile);
      const rankedMission = getNextBestMission(profile, new Date(), progress);
      const offers = rankedMission ? getOffersForMission(profile, rankedMission.mission) : [];
      return { score, safety, rankedMission, offers };
    } catch {
      return {
        score: { score: 0, factors: [] },
        safety: { mode: "normal" as const, reasons: [], suppressOffers: false },
        rankedMission: null,
        offers: [],
      };
    }
  }, [profile, progress]);

  const completed = useMemo(
    () => Object.values(progress).filter((item) => item?.state === "completed").length,
    [progress],
  );

  function persistLocal(nextProfile: CreditProfile, nextProgress: MissionProgressMap) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify(nextProgress));
  }

  function applyLocalAction(action: "start" | "complete" | "defer") {
    const rankedMission = result.rankedMission;
    if (!rankedMission) return;

    const slug = rankedMission.mission.slug;
    let nextProfile = profile;
    let nextMissionProgress: MissionProgress;

    if (action === "start") {
      nextMissionProgress = startMission(progress[slug]);
    } else if (action === "complete") {
      const completedMission = completeMission(profile, rankedMission.mission, progress[slug]);
      nextProfile = completedMission.profile;
      nextMissionProgress = completedMission.progress;
    } else {
      nextMissionProgress = {
        ...progress[slug],
        state: "deferred",
        nextReviewAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      };
    }

    const nextProgress = { ...progress, [slug]: nextMissionProgress };
    setProfile(nextProfile);
    setProgress(nextProgress);
    persistLocal(nextProfile, nextProgress);
  }

  async function performAction(action: "start" | "complete" | "defer") {
    const rankedMission = result.rankedMission;
    if (!rankedMission) return;

    const slug = rankedMission.mission.slug;
    setStatus("");

    const hasConfiguredBackend = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    if (!hasConfiguredBackend) {
      applyLocalAction(action);
      setStatus(action === "start" ? "Mission started." : action === "complete" ? "Mission completed and your plan has been recalculated." : "Mission moved to later.");
      return;
    }

    try {
      const response = await fetch(`/api/missions/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? "We could not update this mission.");
        return;
      }

      const nextProfile = data.profile as CreditProfile;
      const nextProgress = { ...progress, [slug]: data.progress as MissionProgress };
      setProfile(nextProfile);
      setProgress(nextProgress);
      persistLocal(nextProfile, nextProgress);
      setStatus(action === "start" ? "Mission started." : action === "complete" ? "Mission completed and your plan has been recalculated." : "Mission moved to later.");
    } catch {
      setStatus("We could not update this mission. Please try again.");
    }
  }

  const stage = result.rankedMission?.mission.stage ?? "maintain";
  const currentProgress = result.rankedMission ? progress[result.rankedMission.mission.slug] : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between"><Link href="/" className="font-black text-violet-700">Credit Quest</Link><Link href="/offers" className="text-sm font-bold text-slate-600">Offers</Link></header>
      <p className="text-sm font-black uppercase tracking-widest text-violet-600">Your next best move</p>

      {result.safety.mode === "safe_mode" && (
        <section className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="text-xl font-black">Protecting your finances comes first right now.</h2>
          <p className="mt-2 text-sm leading-6">Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.</p>
        </section>
      )}

      {result.rankedMission ? (
        <div className="mt-3">
          <NextMissionCard
            rankedMission={result.rankedMission}
            progress={currentProgress}
            offer={result.offers[0]}
            reviewTiming="Review again in around 30 days"
            onStart={() => performAction("start")}
            onComplete={() => performAction("complete")}
            onDefer={() => performAction("defer")}
          />
        </div>
      ) : (
        <div className="mt-3 rounded-3xl bg-white p-6 shadow"><h2 className="text-2xl font-black">You&apos;re up to date for now.</h2><p className="mt-2 text-slate-600">Review your profile or check back after your next review date.</p></div>
      )}

      {status && <div role="status" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{status}</div>}
      <div className="mt-5"><ProgressStrip score={result.score.score} stage={stage} completed={completed} nextReview="30 days" /></div>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="font-black">Your journey</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">Setup → Stabilise → Build → Optimise → Maintain</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and does not predict whether a lender will approve an application.</p>
      </section>
    </main>
  );
}

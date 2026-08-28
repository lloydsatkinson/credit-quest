"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AcademyCard } from "@/components/academy/academy-card";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { QuestFeed, QuestFeedCard } from "@/components/dashboard/quest-feed";
import { PassportCard } from "@/components/passport/passport-card";
import { ReadinessCard } from "@/components/readiness/readiness-card";
import { DEMO_ACADEMY_ARTICLES } from "@/lib/academy/demo-content";
import { selectAcademyArticle } from "@/lib/academy/selector";
import { getAgeMode } from "@/lib/domain/age-gate";
import { diagnoseBarrier } from "@/lib/domain/diagnosis";
import { completeMission, startMission } from "@/lib/domain/mission-lifecycle";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import { getNextBestMission } from "@/lib/domain/mission-engine";
import { getOffersForMission } from "@/lib/domain/offer-matcher";
import { buildCreditPassport } from "@/lib/domain/passport";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
  CreditProfile,
  MissionProgress,
  MissionProgressMap,
} from "@/lib/domain/types";

const DEMO_PROGRESS_KEY = "creditquest-mission-progress";
const PROFILE_KEY = "creditquest-profile";
const FEED_CARD_TOTAL = 7;

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

const unknownReadiness: ApplicationReadiness = {
  state: "unknown",
  headline: "We need more information",
  reasons: ["Credit Quest could not safely derive readiness from the information currently available."],
  avoid: ["Avoid making a hard application just to test whether you might be approved."],
  actions: ["Review your profile information before relying on this readiness view."],
  reassessAt: null,
  daysUntilReassessment: null,
};

const unknownPassport: CreditPassport = {
  pillars: [
    { id: "identity", title: "Identity & Traceability", status: "unknown", strength: "Not available yet.", helping: [], hurting: [], unknowns: ["This signal could not be derived safely."], nextActions: [] },
    { id: "payment_health", title: "Payment Health", status: "unknown", strength: "Not available yet.", helping: [], hurting: [], unknowns: ["This signal could not be derived safely."], nextActions: [] },
    { id: "debt_headroom", title: "Debt & Headroom", status: "unknown", strength: "Not available yet.", helping: [], hurting: [], unknowns: ["This signal could not be derived safely."], nextActions: [] },
    { id: "affordability_stability", title: "Affordability & Stability", status: "unknown", strength: "Not assessed with current data.", helping: [], hurting: [], unknowns: ["Current profile data is not enough for a responsible affordability assessment."], nextActions: [] },
    { id: "application_readiness", title: "Application Readiness", status: "unknown", strength: "We need more information", helping: [], hurting: [], unknowns: unknownReadiness.reasons, nextActions: unknownReadiness.actions },
  ],
};

const unknownDiagnosis: BarrierDiagnosis = {
  primary: null,
  secondary: [],
  confidence: "low",
  factors: [],
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
      const ageMode = getAgeMode(profile.dateOfBirth);
      const diagnosis = diagnoseBarrier(profile);
      const readiness = assessApplicationReadiness(profile, safety, ageMode);
      const passport = buildCreditPassport(profile, readiness);
      const rankedMission = getNextBestMission(profile, new Date(), progress);
      const academySelection = selectAcademyArticle(DEMO_ACADEMY_ARTICLES, {
        ageMode,
        safety,
        missionKey: rankedMission?.mission.slug ?? null,
        diagnosis,
        passport,
        readiness,
        seenContentKeys: [],
      });
      const offers = rankedMission ? getOffersForMission(profile, rankedMission.mission) : [];
      return { score, safety, ageMode, diagnosis, readiness, passport, rankedMission, academySelection, offers };
    } catch {
      return {
        score: { score: 0, factors: [] },
        safety: { mode: "normal" as const, reasons: [], suppressOffers: false },
        ageMode: "education" as const,
        diagnosis: unknownDiagnosis,
        readiness: unknownReadiness,
        passport: unknownPassport,
        rankedMission: null,
        academySelection: null,
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
  const offer = result.offers[0];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-slate-950">
          <span className="grid size-9 place-items-center rounded-2xl bg-slate-950 text-sm text-white shadow-lg shadow-violet-200">CQ</span>
          <span>Credit Quest</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full border border-white/80 bg-white/75 p-1 text-xs font-black text-slate-600 shadow-sm backdrop-blur">
          <Link href="/accounts" className="rounded-full px-3 py-2 transition hover:bg-slate-100">Accounts</Link>
          <Link href="/offers" className="rounded-full px-3 py-2 transition hover:bg-slate-100">Offers</Link>
        </nav>
      </header>

      {result.safety.mode === "safe_mode" && (
        <section className="mb-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Safe Mode</p>
          <h2 className="mt-2 text-xl font-black">Protecting your finances comes first right now.</h2>
          <p className="mt-2 text-sm leading-6">Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.</p>
        </section>
      )}

      <QuestFeed>
        <QuestFeedCard eyebrow="Your next move" index={1} total={FEED_CARD_TOTAL} tone="ink">
          {result.rankedMission ? (
            <NextMissionCard
              rankedMission={result.rankedMission}
              progress={currentProgress}
              reviewTiming="Review again in around 30 days"
              onStart={() => performAction("start")}
              onComplete={() => performAction("complete")}
              onDefer={() => performAction("defer")}
              embedded
            />
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <h2 className="text-4xl font-black tracking-tight">You’re up to date for now.</h2>
              <p className="mt-4 text-base leading-7 text-slate-300">There is no eligible next-best mission at the moment. We’ll reassess when your information or review dates change.</p>
            </div>
          )}
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Why this matters" index={2} total={FEED_CARD_TOTAL} tone="violet">
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/60">Why it is ranked first</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {result.rankedMission ? result.rankedMission.mission.rationale : "Your plan changes when your information changes."}
            </h2>
            {result.rankedMission?.reasons[0] ? (
              <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-violet-100">{result.rankedMission.reasons[0]}</p>
            ) : (
              <p className="mt-6 max-w-xl text-base leading-7 text-violet-100">Credit Quest only surfaces an action when the deterministic mission rules say it is relevant.</p>
            )}
          </div>
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Your Credit Passport" index={3} total={FEED_CARD_TOTAL} tone="light">
          <PassportCard passport={result.passport} diagnosis={result.diagnosis} />
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Can I apply yet?" index={4} total={FEED_CARD_TOTAL} tone="soft">
          <ReadinessCard readiness={result.readiness} />
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Learn in 20 seconds" index={5} total={FEED_CARD_TOTAL} tone="light">
          <AcademyCard selection={result.academySelection} />
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Your progress" index={6} total={FEED_CARD_TOTAL} tone="light">
          <ProgressStrip score={result.score.score} stage={stage} completed={completed} nextReview="30 days" />
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Know what the score means" index={7} total={FEED_CARD_TOTAL} tone="soft">
          <div className="flex flex-1 flex-col justify-center">
            <span className="w-fit rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">Setup → Stabilise → Build → Optimise → Maintain</span>
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Progress, not a lender prediction.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and it does not predict whether a lender will approve an application.</p>
            <p className="mt-5 text-sm font-bold leading-6 text-violet-700">The goal is simple: make the next sensible move, then reassess rather than applying unnecessarily.</p>
          </div>
        </QuestFeedCard>
      </QuestFeed>

      {status && <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{status}</div>}

      {offer ? (
        <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm" aria-label="Optional partner route">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Optional partner route</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Commercial</span>
          </div>
          <h2 className="mt-3 text-lg font-black text-slate-950">{offer.productName}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{offer.disclosure} Credit Quest does not know whether you will be approved. This route does not change the mission we ranked for you.</p>
          <a className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white" href={offer.affiliateUrl} target="_blank" rel="noreferrer sponsored">Check eligibility with provider</a>
        </section>
      ) : null}
    </main>
  );
}

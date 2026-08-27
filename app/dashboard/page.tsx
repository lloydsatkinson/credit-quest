import Link from "next/link";
import { redirect } from "next/navigation";
import { ResumeActionCard } from "@/components/actions/resume-action-card";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { QuestFeed, QuestFeedCard } from "@/components/dashboard/quest-feed";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { deriveAccountProfileSignals } from "@/lib/domain/account-missions";
import { rankMissionInstances } from "@/lib/domain/mission-engine";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import { assessSafety } from "@/lib/domain/safety";
import type { JourneyStage, MissionInstance } from "@/lib/domain/types";
import { listUserAccounts } from "@/lib/server/account-repository";
import {
  getActionDefinition,
  getProviderById,
  listPendingActionAttempts,
} from "@/lib/server/action-repository";
import { syncMissionInstances } from "@/lib/server/mission-repository";
import { getUserProfile } from "@/lib/server/profile-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;
const FEED_CARD_TOTAL = 4;

function nextReviewLabel(instances: MissionInstance[], now: Date): string {
  const future = instances
    .map((instance) => instance.nextReviewAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > now.getTime())
    .sort((a, b) => a - b)[0];

  if (!future) return "—";
  const days = Math.max(1, Math.ceil((future - now.getTime()) / DAY_MS));
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default async function DashboardPage() {
  if (!getSupabasePublicEnv()) return <DashboardClient />;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  const profile = await getUserProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");

  const now = new Date();
  const accounts = await listUserAccounts(supabase, user.id);
  const effectiveProfile = { ...profile, ...deriveAccountProfileSignals(accounts) };
  const instances = await syncMissionInstances(supabase, effectiveProfile, accounts, now);
  const ranked = rankMissionInstances(effectiveProfile, instances, accounts, now);
  const next = ranked[0] ?? null;
  const pendingAttempts = await listPendingActionAttempts(supabase, user.id, now);
  const pendingAttempt = pendingAttempts[0] ?? null;
  const score = calculateQuestScore(effectiveProfile);
  const safety = assessSafety(effectiveProfile);
  const completed = instances.filter((instance) => instance.state === "completed").length;
  const stage: JourneyStage = next?.mission.stage ?? "maintain";
  const nextReview = nextReviewLabel(instances, now);
  const hasTrackedCreditCard = accounts.some((account) => account.accountType === "credit_card");
  const needsAccountSetup = !hasTrackedCreditCard && effectiveProfile.hasRevolvingCredit === true;

  let pendingView: {
    attempt: NonNullable<typeof pendingAttempt>;
    missionSlug: string;
    missionTitle: string;
    providerLabel: string | null;
  } | null = null;

  if (pendingAttempt) {
    const instance = instances.find((item) => item.id === pendingAttempt.missionInstanceId);
    const mission = instance
      ? MISSION_CATALOGUE.find((item) => item.slug === instance.missionSlug)
      : null;
    const account = pendingAttempt.accountId
      ? accounts.find((item) => item.id === pendingAttempt.accountId)
      : null;

    let providerLabel = account?.nickname
      ?? account?.providerName
      ?? (account?.lastFour ? `card ending ${account.lastFour}` : null);

    if (!providerLabel) {
      const action = await getActionDefinition(supabase, pendingAttempt.actionRegistryId);
      const provider = action ? await getProviderById(supabase, action.providerId) : null;
      providerLabel = provider?.displayName ?? null;
    }

    if (instance && mission) {
      pendingView = {
        attempt: pendingAttempt,
        missionSlug: mission.slug,
        missionTitle: mission.title,
        providerLabel,
      };
    }
  }

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

      {pendingView ? (
        <div className="mb-4">
          <ResumeActionCard
            attempt={pendingView.attempt}
            missionSlug={pendingView.missionSlug}
            missionTitle={pendingView.missionTitle}
            providerLabel={pendingView.providerLabel}
          />
        </div>
      ) : null}

      {safety.mode === "safe_mode" ? (
        <section className="mb-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Safe Mode</p>
          <h2 className="mt-2 text-xl font-black">Protecting your finances comes first right now.</h2>
          <p className="mt-2 text-sm leading-6">Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.</p>
        </section>
      ) : null}

      {needsAccountSetup ? (
        <section className="mb-4 rounded-[1.75rem] border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Account setup</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Add your credit account</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Credit Quest needs a minimal account record before it can target direct-debit or utilisation actions to the right card.</p>
          <Link href="/accounts" className="mt-4 inline-flex rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white">Add an account</Link>
        </section>
      ) : null}

      <QuestFeed>
        <QuestFeedCard eyebrow="Your next move" index={1} total={FEED_CARD_TOTAL} tone="ink">
          {next ? (
            <NextMissionCard
              rankedMission={next}
              progress={{
                state: next.instance.state,
                startedAt: next.instance.startedAt,
                completedAt: next.instance.completedAt,
                nextReviewAt: next.instance.nextReviewAt,
              }}
              actionHref={`/actions/${next.instance.id}`}
              reviewTiming={next.mission.reviewPeriodDays ? `around ${next.mission.reviewPeriodDays} days` : undefined}
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
              {next ? next.mission.rationale : "Your plan changes when your information changes."}
            </h2>
            {next?.reasons[0] ? (
              <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-violet-100">{next.reasons[0]}</p>
            ) : (
              <p className="mt-6 max-w-xl text-base leading-7 text-violet-100">Credit Quest only surfaces an action when the deterministic mission rules say it is relevant.</p>
            )}
          </div>
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Your progress" index={3} total={FEED_CARD_TOTAL} tone="light">
          <ProgressStrip score={score.score} stage={stage} completed={completed} nextReview={nextReview} />
        </QuestFeedCard>

        <QuestFeedCard eyebrow="Know what the score means" index={4} total={FEED_CARD_TOTAL} tone="soft">
          <div className="flex flex-1 flex-col justify-center">
            <span className="w-fit rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">Setup → Stabilise → Build → Optimise → Maintain</span>
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Progress, not a lender prediction.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and it does not predict whether a lender will approve an application.</p>
            <p className="mt-5 text-sm font-bold leading-6 text-violet-700">The goal is simple: make the next sensible move, then reassess rather than applying unnecessarily.</p>
          </div>
        </QuestFeedCard>
      </QuestFeed>
    </main>
  );
}

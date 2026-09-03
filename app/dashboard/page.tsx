import Link from "next/link";
import { redirect } from "next/navigation";
import { ResumeActionCard } from "@/components/actions/resume-action-card";
import { AcademyCard } from "@/components/academy/academy-card";
import { CustomerShell } from "@/components/customer/customer-shell";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { QuestFeed, QuestFeedCard } from "@/components/dashboard/quest-feed";
import { EmailReminderPreference } from "@/components/journey/email-reminder-preference";
import { InAppReminders } from "@/components/journey/in-app-reminders";
import { JourneyStatusCard } from "@/components/journey/journey-status-card";
import { PassportCard } from "@/components/passport/passport-card";
import { ReadinessCard } from "@/components/readiness/readiness-card";
import { RecoveryStatus } from "@/components/recovery/recovery-status";
import { selectAcademyArticle } from "@/lib/academy/selector";
import type { AcademySelection } from "@/lib/academy/types";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { deriveAccountProfileSignals } from "@/lib/domain/account-missions";
import { getAgeMode } from "@/lib/domain/age-gate";
import { diagnoseBarrier } from "@/lib/domain/diagnosis";
import { rankMissionInstances } from "@/lib/domain/mission-engine";
import { buildCreditPassport } from "@/lib/domain/passport";
import { calculateQuestScore } from "@/lib/domain/quest-score";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import type { JourneyStage, MissionInstance } from "@/lib/domain/types";
import type { RecoveryPlanProjection } from "@/lib/recovery/plan";
import { listUserAccounts } from "@/lib/server/account-repository";
import {
  getActionDefinition,
  getProviderById,
  listPendingActionAttempts,
} from "@/lib/server/action-repository";
import {
  listAcademyProgress,
  listPublishedAcademyArticles,
} from "@/lib/server/academy-repository";
import {
  getJourneyState,
  listRecentJourneyOutcomes,
} from "@/lib/server/journey-repository";
import { reassessJourneyForUser } from "@/lib/server/journey-orchestrator";
import { syncMissionInstances } from "@/lib/server/mission-repository";
import { getUserProfile } from "@/lib/server/profile-repository";
import { projectRecoveryForUser } from "@/lib/server/recovery-orchestrator";
import { getLatestRecoveryJourney } from "@/lib/server/recovery-repository";
import {
  getCommunicationPreference,
  listUserInAppReminders,
} from "@/lib/server/reminder-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;
const FEED_CARD_TOTAL = 7;

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
  if (!getSupabasePublicEnv()) {
    return (
      <CustomerShell active="quest">
        <DashboardClient />
      </CustomerShell>
    );
  }

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
  const ageMode = getAgeMode(effectiveProfile.dateOfBirth, now);
  const diagnosis = diagnoseBarrier(effectiveProfile);
  const readiness = assessApplicationReadiness(effectiveProfile, safety, ageMode);
  const passport = buildCreditPassport(effectiveProfile, readiness);
  const completed = instances.filter((instance) => instance.state === "completed").length;
  const stage: JourneyStage = next?.mission.stage ?? "maintain";
  const nextReview = nextReviewLabel(instances, now);
  const hasTrackedCreditCard = accounts.some((account) => account.accountType === "credit_card");
  const needsAccountSetup = !hasTrackedCreditCard && effectiveProfile.hasRevolvingCredit === true;

  let academySelection: AcademySelection | null = null;
  try {
    const [articles, progressRows] = await Promise.all([
      listPublishedAcademyArticles(supabase),
      listAcademyProgress(supabase, user.id),
    ]);
    academySelection = selectAcademyArticle(articles, {
      ageMode,
      safety,
      missionKey: next?.mission.slug ?? null,
      diagnosis,
      passport,
      readiness,
      seenContentKeys: progressRows
        .filter((progress) => progress.lastShownAt)
        .map((progress) => progress.contentKey),
    });
  } catch {
    academySelection = null;
  }

  let journeyState: Awaited<ReturnType<typeof getJourneyState>> = null;
  let journeyOutcomes: Awaited<ReturnType<typeof listRecentJourneyOutcomes>> = [];
  try {
    journeyState = await getJourneyState(supabase, user.id);
    const scheduledAt = journeyState?.nextReassessmentAt ?? null;
    if (scheduledAt && new Date(scheduledAt).getTime() <= now.getTime()) {
      await reassessJourneyForUser({
        userId: user.id,
        sourceKey: `reassessment:${user.id}:${scheduledAt}`,
        now,
      });
      journeyState = await getJourneyState(supabase, user.id);
    }
    journeyOutcomes = await listRecentJourneyOutcomes(supabase, user.id, 5);
  } catch {
    journeyState = null;
    journeyOutcomes = [];
  }

  let recoveryPlan: RecoveryPlanProjection | null = null;
  let recoveryOrigin: "direct" | "partner" | null = null;
  try {
    const recoveryJourney = await getLatestRecoveryJourney(supabase, user.id);
    if (recoveryJourney) {
      recoveryOrigin = recoveryJourney.origin;
      recoveryPlan = await projectRecoveryForUser({
        recoveryJourneyId: recoveryJourney.id,
        userId: user.id,
        now,
      });
    }
  } catch {
    // Recovery is additive. A missing migration or downstream persistence read
    // must not block the established Quest experience.
    recoveryPlan = null;
    recoveryOrigin = null;
  }

  let inAppReminders: Awaited<ReturnType<typeof listUserInAppReminders>> = [];
  try {
    inAppReminders = await listUserInAppReminders(supabase, user.id, now);
  } catch {
    inAppReminders = [];
  }

  let emailReminderEnabled = false;
  try {
    const preference = await getCommunicationPreference(supabase, user.id);
    emailReminderEnabled = preference?.journeyEmailEnabled === true;
  } catch {
    emailReminderEnabled = false;
  }

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
    <CustomerShell active="quest">
      <main className="mx-auto min-h-screen max-w-3xl px-4 pb-8 pt-5 sm:px-6 sm:pt-7">
        <section className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="cq-kicker">Your momentum</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">One useful move at a time.</h1>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Quest progress</p>
            <p className="mt-1 text-lg font-black text-lime-300">{completed} complete</p>
          </div>
        </section>

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
          <section className="mb-4 rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[0.07] p-5 text-amber-50 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Safe Mode</p>
            <h2 className="mt-2 text-xl font-black">Protecting your finances comes first right now.</h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/75">Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.</p>
          </section>
        ) : null}

        {needsAccountSetup ? (
          <section className="cq-panel mb-4 rounded-[1.75rem] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Account setup</p>
            <h2 className="mt-2 text-xl font-black text-white">Add your credit account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Credit Quest needs a minimal account record before it can target direct-debit or utilisation actions to the right card.</p>
            <Link href="/accounts" className="mt-4 inline-flex rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(200,255,56,0.12)]">Add an account</Link>
          </section>
        ) : null}

        {recoveryPlan && recoveryOrigin ? (
          <RecoveryStatus plan={recoveryPlan} origin={recoveryOrigin} />
        ) : null}

        <JourneyStatusCard state={journeyState} latestOutcome={journeyOutcomes[0] ?? null} />
        <InAppReminders reminders={inAppReminders} />
        <EmailReminderPreference initialEnabled={emailReminderEnabled} demo={false} />

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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">Why it is ranked first</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {next ? next.mission.rationale : "Your plan changes when your information changes."}
              </h2>
              {next?.reasons[0] ? (
                <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-slate-300">{next.reasons[0]}</p>
              ) : (
                <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">Credit Quest only surfaces an action when the deterministic mission rules say it is relevant.</p>
              )}
            </div>
          </QuestFeedCard>

          <QuestFeedCard eyebrow="Your Credit Passport" index={3} total={FEED_CARD_TOTAL} tone="light">
            <PassportCard passport={passport} diagnosis={diagnosis} />
          </QuestFeedCard>

          <QuestFeedCard eyebrow="Can I apply yet?" index={4} total={FEED_CARD_TOTAL} tone="soft">
            <ReadinessCard readiness={readiness} />
          </QuestFeedCard>

          <QuestFeedCard eyebrow="Learn in 20 seconds" index={5} total={FEED_CARD_TOTAL} tone="light">
            <AcademyCard selection={academySelection} />
          </QuestFeedCard>

          <QuestFeedCard eyebrow="Your progress" index={6} total={FEED_CARD_TOTAL} tone="light">
            <ProgressStrip score={score.score} stage={stage} completed={completed} nextReview={nextReview} />
          </QuestFeedCard>

          <QuestFeedCard eyebrow="Know what the score means" index={7} total={FEED_CARD_TOTAL} tone="soft">
            <div className="flex flex-1 flex-col justify-center">
              <span className="w-fit rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-lime-300">Setup → Stabilise → Build → Optimise → Maintain</span>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Progress, not a lender prediction.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and it does not predict whether a lender will approve an application.</p>
              <p className="mt-5 text-sm font-bold leading-6 text-cyan-300">The goal is simple: make the next sensible move, then reassess rather than applying unnecessarily.</p>
            </div>
          </QuestFeedCard>
        </QuestFeed>
      </main>
    </CustomerShell>
  );
}

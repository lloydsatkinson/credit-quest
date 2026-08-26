import Link from "next/link";
import { redirect } from "next/navigation";
import { ResumeActionCard } from "@/components/actions/resume-action-card";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { NextMissionCard } from "@/components/dashboard/next-mission-card";
import { ProgressStrip } from "@/components/dashboard/progress-strip";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
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
  const instances = await syncMissionInstances(supabase, profile, accounts, now);
  const ranked = rankMissionInstances(profile, instances, accounts, now);
  const next = ranked[0] ?? null;
  const pendingAttempts = await listPendingActionAttempts(supabase, user.id);
  const pendingAttempt = pendingAttempts[0] ?? null;
  const score = calculateQuestScore(profile);
  const safety = assessSafety(profile);
  const completed = instances.filter((instance) => instance.state === "completed").length;
  const stage: JourneyStage = next?.mission.stage ?? "maintain";
  const needsAccountSetup = accounts.length === 0 && profile.hasRevolvingCredit === true;

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
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="font-black text-violet-700">Credit Quest</Link>
        <nav className="flex items-center gap-4 text-sm font-bold text-slate-600">
          <Link href="/accounts">My accounts</Link>
          <Link href="/offers">Offers</Link>
        </nav>
      </header>

      {pendingView ? (
        <div className="mb-6">
          <ResumeActionCard
            attempt={pendingView.attempt}
            missionSlug={pendingView.missionSlug}
            missionTitle={pendingView.missionTitle}
            providerLabel={pendingView.providerLabel}
          />
        </div>
      ) : null}

      <p className="text-sm font-black uppercase tracking-widest text-violet-600">Your next best move</p>

      {safety.mode === "safe_mode" ? (
        <section className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="text-xl font-black">Protecting your finances comes first right now.</h2>
          <p className="mt-2 text-sm leading-6">Based on the information you gave us, we’re pausing credit-product suggestions and prioritising actions that help protect payments and financial stability.</p>
        </section>
      ) : null}

      {needsAccountSetup ? (
        <section className="mt-3 rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-xl font-black text-slate-950">Add your credit account</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Credit Quest needs a minimal account record before it can target direct-debit or utilisation actions to the right card.</p>
          <Link href="/accounts" className="mt-4 inline-block rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white">Add an account</Link>
        </section>
      ) : null}

      {next ? (
        <div className="mt-3">
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
          />
        </div>
      ) : (
        <div className="mt-3 rounded-3xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">You&apos;re up to date for now.</h2>
          <p className="mt-2 text-slate-600">Review your profile or check back after your next review date.</p>
        </div>
      )}

      <div className="mt-5">
        <ProgressStrip
          score={score.score}
          stage={stage}
          completed={completed}
          nextReview={nextReviewLabel(instances, now)}
        />
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="font-black">Your journey</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">Setup → Stabilise → Build → Optimise → Maintain</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">Your Credit Quest Score is an internal progress indicator. It is not a bureau credit score and does not predict whether a lender will approve an application.</p>
      </section>
    </main>
  );
}

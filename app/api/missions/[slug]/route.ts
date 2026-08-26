import { NextResponse } from "next/server";
import { z } from "zod";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { completeMission, startMission } from "@/lib/domain/mission-lifecycle";
import type { CreditProfile, MissionProgress } from "@/lib/domain/types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const missionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("defer") }).strict(),
  z.object({ action: z.literal("dismiss") }).strict(),
]);

const eventNameByAction = {
  start: "mission_started",
  complete: "mission_completed",
  defer: "mission_deferred",
  dismiss: "mission_dismissed",
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const parsed = missionActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid mission action" }, { status: 400 });

  const { slug } = await context.params;
  const mission = MISSION_CATALOGUE.find((item) => item.slug === slug);
  if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 404 });

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json({ mode: "demo", action: parsed.data.action, missionSlug: mission.slug });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: row, error: profileReadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileReadError) return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const profile: CreditProfile = {
    userId: row.user_id,
    dateOfBirth: row.date_of_birth,
    employmentStatus: row.employment_status,
    incomeBand: row.income_band,
    housingStatus: row.housing_status,
    electoralRoll: row.electoral_roll,
    utilisationPct: row.utilisation_pct === null ? null : Number(row.utilisation_pct),
    missedPaymentsLast12m: row.missed_payments_last_12m,
    hardApplicationsLast6m: row.hard_applications_last_6m,
    hasRevolvingCredit: row.has_revolving_credit,
    hasDirectDebitForCredit: row.has_direct_debit_for_credit,
  };

  const { data: missionRow, error: missionReadError } = await supabase
    .from("user_missions")
    .select("state, started_at, completed_at, next_review_at")
    .eq("user_id", user.id)
    .eq("mission_slug", mission.slug)
    .maybeSingle();

  if (missionReadError) return NextResponse.json({ error: "Could not load mission" }, { status: 500 });

  const currentProgress: MissionProgress | undefined = missionRow
    ? {
        state: missionRow.state as MissionProgress["state"],
        startedAt: missionRow.started_at,
        completedAt: missionRow.completed_at,
        nextReviewAt: missionRow.next_review_at,
      }
    : undefined;

  if (parsed.data.action === "complete" && currentProgress?.state !== "started") {
    return NextResponse.json({ error: "Start this mission before completing it" }, { status: 409 });
  }
  if (parsed.data.action === "start" && currentProgress && ["completed", "dismissed", "no_longer_eligible"].includes(currentProgress.state)) {
    return NextResponse.json({ error: "This mission cannot be restarted" }, { status: 409 });
  }

  const now = new Date();
  let nextProfile = profile;
  let nextProgress: MissionProgress;

  if (parsed.data.action === "start") {
    nextProgress = startMission(currentProgress, now);
  } else if (parsed.data.action === "complete") {
    const result = completeMission(profile, mission, currentProgress, now);
    nextProfile = result.profile;
    nextProgress = result.progress;
  } else if (parsed.data.action === "defer") {
    nextProgress = {
      ...currentProgress,
      state: "deferred",
      completedAt: currentProgress?.completedAt ?? null,
      nextReviewAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    };
  } else {
    nextProgress = {
      ...currentProgress,
      state: "dismissed",
      completedAt: currentProgress?.completedAt ?? null,
      nextReviewAt: null,
    };
  }

  if (nextProfile !== profile) {
    const { error: profileWriteError } = await supabase
      .from("profiles")
      .update({
        electoral_roll: nextProfile.electoralRoll,
        has_direct_debit_for_credit: nextProfile.hasDirectDebitForCredit,
        has_revolving_credit: nextProfile.hasRevolvingCredit,
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id);

    if (profileWriteError) return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  const { error: missionWriteError } = await supabase
    .from("user_missions")
    .upsert({
      user_id: user.id,
      mission_slug: mission.slug,
      state: nextProgress.state,
      started_at: nextProgress.startedAt ?? null,
      completed_at: nextProgress.completedAt ?? null,
      next_review_at: nextProgress.nextReviewAt ?? null,
      deferred_at: nextProgress.state === "deferred" ? now.toISOString() : null,
      dismissed_at: nextProgress.state === "dismissed" ? now.toISOString() : null,
      updated_at: now.toISOString(),
    });

  if (missionWriteError) return NextResponse.json({ error: "Could not update mission" }, { status: 500 });

  await supabase.from("events").insert({
    user_id: user.id,
    event_name: eventNameByAction[parsed.data.action],
    metadata: { missionSlug: mission.slug },
  });

  return NextResponse.json({
    missionSlug: mission.slug,
    action: parsed.data.action,
    profile: nextProfile,
    progress: nextProgress,
  });
}

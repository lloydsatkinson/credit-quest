import { NextResponse } from "next/server";
import { z } from "zod";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { canStartMission } from "@/lib/domain/mission-engine";
import { completeMission, startMission } from "@/lib/domain/mission-lifecycle";
import type { MissionDefinition, MissionProgress } from "@/lib/domain/types";
import { getUserProfile, updateUserProfile } from "@/lib/server/profile-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const missionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("defer") }).strict(),
  z.object({ action: z.literal("dismiss") }).strict(),
]);

type LegacyMissionAction = z.infer<typeof missionActionSchema>["action"];

const eventNameByAction = {
  start: "mission_started",
  complete: "mission_completed",
  defer: "mission_deferred",
  dismiss: "mission_dismissed",
} as const;

export function canUseLegacyMissionAction(mission: MissionDefinition, action: LegacyMissionAction): boolean {
  if (mission.scope === "account") return false;
  if (mission.slug === "register-electoral-roll" && action === "complete") return false;
  return true;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const parsed = missionActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid mission action" }, { status: 400 });

  const { slug } = await context.params;
  const mission = MISSION_CATALOGUE.find((item) => item.slug === slug);
  if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 404 });
  if (!canUseLegacyMissionAction(mission, parsed.data.action)) {
    return NextResponse.json({ error: "Use the Mission Action Layer for this action" }, { status: 409 });
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    return NextResponse.json({ mode: "demo", action: parsed.data.action, missionSlug: mission.slug });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await getUserProfile(supabase, user.id).catch(() => null);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { data: missionRow, error: missionReadError } = await supabase
    .from("user_missions")
    .select("id,state,started_at,completed_at,next_review_at")
    .eq("user_id", user.id)
    .eq("mission_slug", mission.slug)
    .eq("subject_type", "profile")
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

  if (parsed.data.action === "start") {
    const startAccess = canStartMission(profile, mission, now);
    if (!startAccess.allowed) {
      return NextResponse.json({ error: startAccess.reason }, { status: 409 });
    }
  }

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
    try {
      await updateUserProfile(supabase, user.id, {
        electoralRoll: nextProfile.electoralRoll,
        hasDirectDebitForCredit: nextProfile.hasDirectDebitForCredit,
        hasRevolvingCredit: nextProfile.hasRevolvingCredit,
      }, now);
    } catch {
      return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }
  }

  const missionPayload = {
    user_id: user.id,
    mission_slug: mission.slug,
    subject_type: "profile",
    subject_id: null,
    state: nextProgress.state,
    started_at: nextProgress.startedAt ?? null,
    completed_at: nextProgress.completedAt ?? null,
    next_review_at: nextProgress.nextReviewAt ?? null,
    deferred_at: nextProgress.state === "deferred" ? now.toISOString() : null,
    dismissed_at: nextProgress.state === "dismissed" ? now.toISOString() : null,
    updated_at: now.toISOString(),
  };

  const missionWrite = missionRow?.id
    ? await supabase.from("user_missions").update(missionPayload).eq("id", missionRow.id).eq("user_id", user.id)
    : await supabase.from("user_missions").insert(missionPayload);

  if (missionWrite.error) return NextResponse.json({ error: "Could not update mission" }, { status: 500 });

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

import type { CompletionEffect, CreditProfile, MissionDefinition, MissionProgress } from "@/lib/domain/types";

export function startMission(current: MissionProgress | undefined, now = new Date()): MissionProgress {
  return {
    ...current,
    state: "started",
    startedAt: current?.startedAt ?? now.toISOString(),
    completedAt: null,
    nextReviewAt: current?.nextReviewAt ?? null,
  };
}

export function applyCompletionEffect(profile: CreditProfile, effect?: CompletionEffect): CreditProfile {
  if (!effect) return profile;
  if (effect.type === "set_profile_value") {
    return { ...profile, [effect.field]: effect.value };
  }
  return profile;
}

export function completeMission(
  profile: CreditProfile,
  mission: MissionDefinition,
  current: MissionProgress | undefined,
  now = new Date(),
): { profile: CreditProfile; progress: MissionProgress } {
  const completedAt = now.toISOString();

  return {
    profile: applyCompletionEffect(profile, mission.completionEffect),
    progress: {
      ...current,
      state: "completed",
      startedAt: current?.startedAt ?? completedAt,
      completedAt,
      nextReviewAt: mission.reviewPeriodDays
        ? new Date(now.getTime() + mission.reviewPeriodDays * 86_400_000).toISOString()
        : null,
    },
  };
}

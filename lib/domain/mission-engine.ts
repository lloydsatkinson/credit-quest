import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile, MissionProgressMap, RankedMission } from "@/lib/domain/types";

function missionPriority(profile: CreditProfile, slug: string, base: number): number {
  if (slug === "reduce-utilisation" && (profile.utilisationPct ?? 0) > 50) return 100;
  return base;
}

function reasonFor(profile: CreditProfile, slug: string): string {
  switch (slug) {
    case "register-electoral-roll": return "Your profile says you are not currently registered on the electoral roll.";
    case "reduce-utilisation": return `Your current utilisation is about ${profile.utilisationPct ?? 0}%.`;
    case "application-cooldown": return `You reported ${profile.hardApplicationsLast6m ?? 0} hard applications in the last six months.`;
    case "set-up-direct-debit": return "You have revolving credit but no direct debit set up for it.";
    case "build-revolving-history": return "You do not currently have revolving credit history.";
    default: return "This action matches the information in your profile.";
  }
}

function isAvailableByProgress(slug: string, progress: MissionProgressMap, now: Date): boolean {
  const current = progress[slug];
  if (!current) return true;
  if (["completed", "dismissed", "no_longer_eligible"].includes(current.state)) return false;
  if (["deferred", "cooldown", "in_review"].includes(current.state)) {
    if (!current.nextReviewAt) return false;
    return new Date(current.nextReviewAt) <= now;
  }
  return true;
}

export function rankMissions(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission[] {
  const safety = assessSafety(profile);

  return MISSION_CATALOGUE
    .filter((mission) => safety.mode !== "safe_mode" || mission.safeModeAllowed)
    .filter((mission) => mission.isEligible(profile, now))
    .filter((mission) => isAvailableByProgress(mission.slug, progress, now))
    .map((mission) => {
      const startedBoost = progress[mission.slug]?.state === "started" ? 1000 : 0;
      return {
        mission,
        priorityScore: missionPriority(profile, mission.slug, mission.priorityWeight) + startedBoost,
        reasons: [reasonFor(profile, mission.slug)],
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.mission.slug.localeCompare(b.mission.slug));
}

export function getNextBestMission(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission | null {
  return rankMissions(profile, now, progress)[0] ?? null;
}

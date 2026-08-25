import { MISSION_CATALOGUE } from "@/lib/data/missions";
import type { CreditProfile, RankedMission } from "@/lib/domain/types";

function missionPriority(profile: CreditProfile, slug: string, base: number): number {
  if (slug === "reduce-utilisation" && (profile.utilisationPct ?? 0) > 50) return 100;
  return base;
}

function reasonFor(profile: CreditProfile, slug: string): string {
  switch (slug) {
    case "register-electoral-roll": return "Your profile says you are not currently registered on the electoral roll.";
    case "reduce-utilisation": return `Your current utilisation is about ${profile.utilisationPct ?? 0}%.`;
    case "application-cooldown": return `You reported ${profile.hardApplicationsLast6m} hard applications in the last six months.`;
    case "set-up-direct-debit": return "You have revolving credit but no direct debit set up for it.";
    case "build-revolving-history": return "You do not currently have revolving credit history.";
    default: return "This action matches the information in your profile.";
  }
}

export function rankMissions(profile: CreditProfile, now = new Date()): RankedMission[] {
  return MISSION_CATALOGUE
    .filter((mission) => mission.isEligible(profile, now))
    .map((mission) => ({
      mission,
      priorityScore: missionPriority(profile, mission.slug, mission.priorityWeight),
      reasons: [reasonFor(profile, mission.slug)],
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.mission.slug.localeCompare(b.mission.slug));
}

export function getNextBestMission(profile: CreditProfile, now = new Date()): RankedMission | null {
  return rankMissions(profile, now)[0] ?? null;
}

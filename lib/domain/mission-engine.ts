import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { calculateAccountUtilisation } from "@/lib/domain/account-missions";
import { assessSafety } from "@/lib/domain/safety";
import type {
  CreditProfile,
  MissionDefinition,
  MissionInstance,
  MissionProgressMap,
  RankedMission,
  UserAccount,
} from "@/lib/domain/types";

export interface RankedMissionInstance extends RankedMission {
  instance: MissionInstance;
}

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

function isAvailableState(
  state: MissionInstance["state"],
  nextReviewAt: string | null | undefined,
  now: Date,
): boolean {
  if (["completed", "dismissed", "no_longer_eligible"].includes(state)) return false;
  if (["deferred", "cooldown", "in_review"].includes(state)) {
    if (!nextReviewAt) return false;
    return new Date(nextReviewAt) <= now;
  }
  return true;
}

function isAvailableByProgress(slug: string, progress: MissionProgressMap, now: Date): boolean {
  const current = progress[slug];
  if (!current) return true;
  return isAvailableState(current.state, current.nextReviewAt, now);
}

function accountReason(mission: MissionDefinition, account: UserAccount | undefined): string {
  if (!account) return "This action applies to one of your credit accounts.";
  const label = account.nickname ?? account.providerName ?? (account.lastFour ? `card ending ${account.lastFour}` : "this card");
  if (mission.slug === "reduce-utilisation") {
    const utilisation = calculateAccountUtilisation(account);
    return utilisation === null
      ? `Update ${label} so Credit Quest can confirm its utilisation.`
      : `${label} is using about ${utilisation}% of its credit limit.`;
  }
  if (mission.slug === "set-up-direct-debit") {
    return `${label} does not currently have a confirmed direct debit.`;
  }
  return `This action applies to ${label}.`;
}

export function canStartMission(
  profile: CreditProfile,
  mission: MissionDefinition,
  now = new Date(),
): { allowed: true } | { allowed: false; reason: string } {
  const safety = assessSafety(profile);
  if (safety.mode === "safe_mode" && !mission.safeModeAllowed) {
    return {
      allowed: false,
      reason: "This mission is paused while Credit Quest prioritises financial stability.",
    };
  }

  if (!mission.isEligible(profile, now)) {
    return {
      allowed: false,
      reason: "This mission is not currently eligible for your profile.",
    };
  }

  return { allowed: true };
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

export function rankMissionInstances(
  profile: CreditProfile,
  instances: MissionInstance[],
  accounts: UserAccount[],
  now = new Date(),
): RankedMissionInstance[] {
  const safety = assessSafety(profile);
  const missionBySlug = new Map(MISSION_CATALOGUE.map((mission) => [mission.slug, mission]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  return instances
    .flatMap((instance): RankedMissionInstance[] => {
      const mission = missionBySlug.get(instance.missionSlug);
      if (!mission) return [];
      if (safety.mode === "safe_mode" && !mission.safeModeAllowed) return [];
      if (!isAvailableState(instance.state, instance.nextReviewAt, now)) return [];

      const account = instance.subject.kind === "account"
        ? accountById.get(instance.subject.accountId)
        : undefined;
      const accountUtilisation = account ? calculateAccountUtilisation(account) : null;
      const basePriority = mission.slug === "reduce-utilisation" && accountUtilisation !== null && accountUtilisation > 50
        ? 100
        : missionPriority(profile, mission.slug, mission.priorityWeight);
      const startedBoost = instance.state === "started" ? 1000 : 0;

      return [{
        instance,
        mission,
        priorityScore: basePriority + startedBoost,
        reasons: [instance.subject.kind === "account" ? accountReason(mission, account) : reasonFor(profile, mission.slug)],
      }];
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.instance.id.localeCompare(b.instance.id));
}

export function getNextBestMission(
  profile: CreditProfile,
  now = new Date(),
  progress: MissionProgressMap = {},
): RankedMission | null {
  return rankMissions(profile, now, progress)[0] ?? null;
}

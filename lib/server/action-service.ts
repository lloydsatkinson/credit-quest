import type { SupabaseClient } from "@supabase/supabase-js";
import { MISSION_CATALOGUE } from "@/lib/data/missions";
import { resolveAction, isAllowedDestination } from "@/lib/domain/action-resolver";
import { getAgeYears } from "@/lib/domain/age-gate";
import { assessSafety } from "@/lib/domain/safety";
import type {
  ActionDefinition,
  CreditProfile,
  MissionDefinition,
  MissionInstance,
  ProviderDefinition,
  ResolvedAction,
  UserAccount,
} from "@/lib/domain/types";
import { getUserAccount } from "@/lib/server/account-repository";
import { listActiveActions, listProviders } from "@/lib/server/action-repository";
import { getMissionInstance } from "@/lib/server/mission-repository";
import { getUserProfile } from "@/lib/server/profile-repository";

export interface MissionActionContext {
  instance: MissionInstance;
  mission: MissionDefinition;
  profile: CreditProfile;
  account: UserAccount | null;
  targetProvider: ProviderDefinition | null;
  actionProvider: ProviderDefinition | null;
  actionDefinition: ActionDefinition;
  resolvedAction: ResolvedAction;
}

export type MissionActionContextResult =
  | { ok: true; context: MissionActionContext }
  | { ok: false; status: 404 | 409; error: string };

const BLOCKED_INSTANCE_STATES: MissionInstance["state"][] = [
  "completed",
  "dismissed",
  "no_longer_eligible",
  "in_review",
  "cooldown",
];

export async function resolveOwnedMissionAction(
  supabase: SupabaseClient,
  userId: string,
  missionInstanceId: string,
  now = new Date(),
): Promise<MissionActionContextResult> {
  const instance = await getMissionInstance(supabase, userId, missionInstanceId);
  if (!instance) return { ok: false, status: 404, error: "Mission not found" };
  if (BLOCKED_INSTANCE_STATES.includes(instance.state)) {
    return { ok: false, status: 409, error: "This mission is not ready for a new action" };
  }

  const mission = MISSION_CATALOGUE.find((item) => item.slug === instance.missionSlug);
  if (!mission) return { ok: false, status: 404, error: "Mission definition not found" };

  const profile = await getUserProfile(supabase, userId);
  if (!profile) return { ok: false, status: 404, error: "Profile not found" };

  let account: UserAccount | null = null;
  if (instance.subject.kind === "account") {
    account = await getUserAccount(supabase, userId, instance.subject.accountId);
    if (!account || !account.active) {
      return { ok: false, status: 409, error: "The target account is no longer available" };
    }
  }

  const [actions, providers] = await Promise.all([
    listActiveActions(supabase, mission.slug),
    listProviders(supabase),
  ]);
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const targetProvider = account?.providerId ? providerById.get(account.providerId) ?? null : null;
  const safety = assessSafety(profile);
  const resolvedAction = resolveAction({
    missionSlug: mission.slug,
    provider: targetProvider,
    providers,
    accountType: account?.accountType ?? null,
    actions,
    age: getAgeYears(profile.dateOfBirth, now),
    safeMode: safety.mode === "safe_mode",
  });

  if (!resolvedAction) {
    return { ok: false, status: 409, error: "No safe action is currently available for this mission" };
  }

  const actionDefinition = actions.find((action) => action.id === resolvedAction.actionId);
  if (!actionDefinition) {
    return { ok: false, status: 409, error: "The selected action is no longer available" };
  }
  const actionProvider = actionDefinition.providerId
    ? providerById.get(actionDefinition.providerId) ?? null
    : null;

  if (resolvedAction.mode === "external_link") {
    if (!resolvedAction.destinationUrl || !isAllowedDestination(resolvedAction.destinationUrl, actionProvider)) {
      return { ok: false, status: 409, error: "The external destination failed the provider allowlist check" };
    }
  } else if (resolvedAction.destinationUrl && !isAllowedDestination(resolvedAction.destinationUrl, actionProvider)) {
    return { ok: false, status: 409, error: "The action destination is not allowed" };
  }

  return {
    ok: true,
    context: {
      instance,
      mission,
      profile,
      account,
      targetProvider,
      actionProvider,
      actionDefinition,
      resolvedAction,
    },
  };
}

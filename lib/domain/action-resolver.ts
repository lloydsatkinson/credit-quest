import type {
  AccountType,
  ActionDefinition,
  ProviderDefinition,
  ResolvedAction,
} from "@/lib/domain/types";

export interface ResolveActionInput {
  missionSlug: string;
  provider: ProviderDefinition | null;
  accountType: AccountType | null;
  actions: ActionDefinition[];
  age: number;
  safeMode: boolean;
}

export function isAllowedDestination(url: string, provider: ProviderDefinition | null): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (!provider || !provider.active) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && provider.allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function candidateScore(
  action: ActionDefinition,
  provider: ProviderDefinition | null,
  accountType: AccountType | null,
): number {
  const providerMatches = provider !== null && action.providerId === provider.id;
  const accountMatches = accountType !== null && action.accountType === accountType;

  if (providerMatches && accountMatches) return 4000 - action.priority;
  if (providerMatches && action.accountType === null) return 3000 - action.priority;
  if (action.providerId === null && accountMatches) return 2000 - action.priority;
  if (action.providerId === null && action.accountType === null) return 1000 - action.priority;
  return -1;
}

export function resolveAction(input: ResolveActionInput): ResolvedAction | null {
  const candidates = input.actions
    .filter((action) => action.active)
    .filter((action) => action.missionSlug === input.missionSlug)
    .filter((action) => action.minAge === null || input.age >= action.minAge)
    .filter((action) => !input.safeMode || action.safeModeAllowed)
    .map((action) => ({ action, score: candidateScore(action, input.provider, input.accountType) }))
    .filter(({ score }) => score >= 0)
    .filter(({ action }) => {
      if (action.mode !== "external_link" || action.destinationUrl === null) return true;
      const destinationProvider = action.providerId === input.provider?.id ? input.provider : null;
      return isAllowedDestination(action.destinationUrl, destinationProvider);
    })
    .sort((a, b) => b.score - a.score || a.action.actionKey.localeCompare(b.action.actionKey));

  const selected = candidates[0]?.action;
  if (!selected) return null;

  return {
    actionId: selected.id,
    mode: selected.mode,
    providerName: selected.providerId === input.provider?.id ? input.provider.displayName : null,
    destinationUrl: selected.destinationUrl,
    instructions: selected.instructions,
    verificationMode: selected.verificationMode,
    fallbackUsed: selected.providerId !== input.provider?.id,
  };
}

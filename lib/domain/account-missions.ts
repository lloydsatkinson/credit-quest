import { MISSION_CATALOGUE } from "@/lib/data/missions";
import type { CreditProfile, MissionInstance, UserAccount } from "@/lib/domain/types";

export function calculateAccountUtilisation(account: UserAccount): number | null {
  if (account.balanceMinor === null || account.creditLimitMinor === null || account.creditLimitMinor <= 0) {
    return null;
  }
  return Math.round((account.balanceMinor / account.creditLimitMinor) * 10000) / 100;
}

export function deriveAccountProfileSignals(
  accounts: UserAccount[],
): Partial<Pick<CreditProfile, "utilisationPct" | "hasDirectDebitForCredit" | "hasRevolvingCredit">> {
  const creditCards = accounts.filter((account) => account.active && account.accountType === "credit_card");
  if (creditCards.length === 0) return {};

  const hasUnknownUtilisation = creditCards.some((account) => (
    account.balanceMinor === null || account.creditLimitMinor === null || account.creditLimitMinor <= 0
  ));

  let utilisationPct: number | null = null;
  if (!hasUnknownUtilisation) {
    const totalBalance = creditCards.reduce((sum, account) => sum + (account.balanceMinor ?? 0), 0);
    const totalLimit = creditCards.reduce((sum, account) => sum + (account.creditLimitMinor ?? 0), 0);
    utilisationPct = totalLimit > 0
      ? Math.round((totalBalance / totalLimit) * 10000) / 100
      : null;
  }

  const hasDirectDebitForCredit = creditCards.some((account) => account.directDebitStatus === "no")
    ? false
    : creditCards.some((account) => account.directDebitStatus === "unknown")
      ? null
      : true;

  return {
    utilisationPct,
    hasDirectDebitForCredit,
    hasRevolvingCredit: true,
  };
}

export function amountToReachUtilisation(account: UserAccount, thresholdPct: number): number | null {
  if (account.balanceMinor === null || account.creditLimitMinor === null || account.creditLimitMinor <= 0) {
    return null;
  }
  const targetBalance = Math.floor(account.creditLimitMinor * (thresholdPct / 100));
  return Math.max(0, account.balanceMinor - targetBalance);
}

export function utilisationTargetCopy(account: UserAccount, thresholdPct = 30): string | null {
  const amount = amountToReachUtilisation(account, thresholdPct);
  if (amount === null || amount <= 0) return null;
  return `Based on the balance and limit you entered, reducing this balance by about £${(amount / 100).toFixed(2)} would bring this card to around ${thresholdPct}% utilisation. This is a planning target, not a guaranteed credit-score outcome.`;
}

export function buildMissionInstances(
  profile: CreditProfile,
  accounts: UserAccount[],
  existing: MissionInstance[] = [],
  now = new Date(),
): MissionInstance[] {
  const byKey = new Map(existing.map((item) => [
    `${item.missionSlug}:${item.subject.kind === "profile" ? "profile" : item.subject.accountId}`,
    item,
  ]));
  const result: MissionInstance[] = [];

  for (const mission of MISSION_CATALOGUE) {
    if (mission.scope === "profile") {
      if (!mission.isEligible(profile, now)) continue;
      const key = `${mission.slug}:profile`;
      result.push(byKey.get(key) ?? {
        id: `local:${key}`,
        userId: profile.userId,
        missionSlug: mission.slug,
        subject: { kind: "profile" },
        state: "not_started",
        startedAt: null,
        completedAt: null,
        nextReviewAt: null,
      });
      continue;
    }

    const creditCards = accounts.filter((item) => item.active && item.accountType === "credit_card");
    for (const account of creditCards) {
      const eligible = mission.slug === "set-up-direct-debit"
        ? account.directDebitStatus === "no"
        : mission.slug === "reduce-utilisation"
          ? (calculateAccountUtilisation(account) ?? 0) > 30
          : false;

      if (!eligible) continue;
      const key = `${mission.slug}:${account.id}`;
      result.push(byKey.get(key) ?? {
        id: `local:${key}`,
        userId: profile.userId,
        missionSlug: mission.slug,
        subject: { kind: "account", accountId: account.id },
        state: "not_started",
        startedAt: null,
        completedAt: null,
        nextReviewAt: null,
      });
    }
  }

  return result;
}

import type { CreditProfile } from "@/lib/domain/types";

export interface QuestScoreResult {
  score: number;
  factors: string[];
}

export function calculateQuestScore(profile: CreditProfile): QuestScoreResult {
  let score = 50;
  const factors: string[] = [];

  if (profile.electoralRoll) {
    score += 10;
    factors.push("+10 for being registered on the electoral roll");
  }

  if (profile.utilisationPct !== null) {
    if (profile.utilisationPct <= 30) {
      score += 10;
      factors.push("+10 for keeping revolving utilisation at or below 30%");
    } else if (profile.utilisationPct <= 50) {
      score += 5;
      factors.push("+5 for keeping revolving utilisation at or below 50%");
    } else if (profile.utilisationPct > 75) {
      score -= 10;
      factors.push("-10 for revolving utilisation above 75%");
    }
  }

  if (profile.missedPaymentsLast12m > 0) {
    const penalty = Math.min(profile.missedPaymentsLast12m * 15, 30);
    score -= penalty;
    factors.push(`-${penalty} for missed payments in the last 12 months`);
  }

  if (profile.hardApplicationsLast6m > 1) {
    const penalty = Math.min((profile.hardApplicationsLast6m - 1) * 5, 15);
    score -= penalty;
    factors.push(`-${penalty} for multiple recent hard credit applications`);
  }

  if (profile.hasRevolvingCredit) {
    score += 5;
    factors.push("+5 for having revolving credit history");
  }

  if (profile.hasDirectDebitForCredit) {
    score += 5;
    factors.push("+5 for using a direct debit to reduce missed-payment risk");
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

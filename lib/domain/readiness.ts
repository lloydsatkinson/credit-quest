import type { SafetyAssessment } from "@/lib/domain/safety";
import type {
  AgeMode,
  ApplicationReadiness,
  CreditProfile,
  ReadinessState,
} from "@/lib/domain/types";

function readinessResult(
  state: ReadinessState,
  headline: string,
  reasons: string[],
  avoid: string[],
  actions: string[],
): ApplicationReadiness {
  return {
    state,
    headline,
    reasons,
    avoid,
    actions,
    reassessAt: null,
    daysUntilReassessment: null,
  };
}

function missingEvidence(profile: CreditProfile): string[] {
  const missing: string[] = [];

  if (profile.missedPaymentsLast12m === null) {
    missing.push("We do not yet know whether you have missed payments in the last 12 months.");
  }
  if (profile.hardApplicationsLast6m === null) {
    missing.push("We do not yet know how many hard credit applications you made in the last 6 months.");
  }
  if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) {
    missing.push("You have revolving credit, but we do not yet know your current utilisation.");
  }

  return missing;
}

export function assessApplicationReadiness(
  profile: CreditProfile,
  safety: SafetyAssessment,
  ageMode: AgeMode,
): ApplicationReadiness {
  if (ageMode === "education") {
    return readinessResult(
      "unknown",
      "Products can wait",
      ["Credit Quest is keeping this experience focused on learning and preparation until you are 18."],
      ["Do not use borrowing as a way to chase a credit score before you are eligible for adult credit products."],
      ["Learn how credit files, payments and applications work so you are better prepared later."],
    );
  }

  if (safety.mode === "safe_mode") {
    return readinessResult(
      "red",
      "Do not apply yet",
      safety.reasons.length > 0
        ? safety.reasons
        : ["Protecting payment stability is more important than taking new credit right now."],
      ["Avoid another credit application or unnecessary new borrowing while these stability signals are present."],
      ["Prioritise keeping existing payments up to date and preventing another missed payment."],
    );
  }

  const missing = missingEvidence(profile);
  if (missing.length > 0) {
    const actions: string[] = [];
    if (profile.missedPaymentsLast12m === null) {
      actions.push("Check your recent payment history so Credit Quest can use a known missed-payment answer.");
    }
    if (profile.hardApplicationsLast6m === null) {
      actions.push("Confirm how many hard credit applications you made in the last 6 months.");
    }
    if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) {
      actions.push("Check your current balances and credit limits so you can estimate utilisation.");
    }

    return readinessResult(
      "unknown",
      "We need more information",
      missing,
      ["Avoid making a new hard application just to test whether you might be approved."],
      actions,
    );
  }

  if ((profile.missedPaymentsLast12m ?? 0) >= 2) {
    return readinessResult(
      "red",
      "Do not apply yet",
      [`You reported ${profile.missedPaymentsLast12m} missed payments in the last 12 months.`],
      ["Avoid another unnecessary hard application while recent payment problems are still part of your current profile."],
      ["Focus first on keeping every current payment up to date and completing the relevant recovery missions."],
    );
  }

  if ((profile.hardApplicationsLast6m ?? 0) >= 3) {
    return readinessResult(
      "red",
      "Do not apply yet",
      [`You reported ${profile.hardApplicationsLast6m} hard credit applications in the last 6 months.`],
      ["Avoid another hard application until your recent application activity has had more time to settle."],
      ["Use Credit Quest to improve the rest of your profile and use soft-search tools only where appropriate."],
    );
  }

  if (profile.missedPaymentsLast12m === 1) {
    return readinessResult(
      "amber",
      "Getting closer",
      ["You reported one missed payment in the last 12 months."],
      ["Avoid adding an unnecessary hard search while your recent payment history still needs care."],
      ["Keep current payments protected and up to date while you work through your next mission."],
    );
  }

  if (profile.hardApplicationsLast6m === 2) {
    return readinessResult(
      "amber",
      "Getting closer",
      ["You reported two hard credit applications in the last 6 months."],
      ["Avoid another unnecessary hard application right now."],
      ["Keep improving your profile and prefer soft-search eligibility tools where they are available."],
    );
  }

  if (
    profile.hasRevolvingCredit === true
    && profile.utilisationPct !== null
    && profile.utilisationPct > 30
  ) {
    return readinessResult(
      "amber",
      "Getting closer",
      [`Your reported utilisation is ${profile.utilisationPct}%, above the Credit Quest 30% planning range.`],
      ["Avoid taking new credit simply to create more available limit."],
      ["Reduce utilisation where affordable and practical, then review your position again."],
    );
  }

  if (profile.hasRevolvingCredit === false) {
    return readinessResult(
      "amber",
      "Getting closer",
      ["You told us you do not currently have revolving credit, so Credit Quest has limited evidence of established revolving-credit history."],
      ["Avoid making multiple applications in quick succession to try to create credit history faster."],
      ["Follow the next safe credit-history mission and use eligibility-first routes when a product step becomes appropriate."],
    );
  }

  return readinessResult(
    "green",
    "Worth checking eligibility",
    ["The blockers Credit Quest currently checks are not present in the information you gave us."],
    ["Avoid going straight to a hard application when a soft-search route is available."],
    ["Use a soft eligibility check where available before considering an application."],
  );
}

import type { BarrierDiagnosis, CreditProfile, DiagnosisFactor } from "@/lib/domain/types";

function factor(code: string, label: string, evidence: string): DiagnosisFactor {
  return { code, label, evidence };
}

export function diagnoseBarrier(profile: CreditProfile): BarrierDiagnosis {
  const missedPayments = profile.missedPaymentsLast12m;
  const hardApplications = profile.hardApplicationsLast6m;

  if (missedPayments !== null && missedPayments >= 2) {
    return {
      primary: "credit_rebuilder",
      secondary: [],
      confidence: "high",
      factors: [
        factor(
          "repeated_missed_payments",
          "Recent payment history",
          "You reported two or more missed payments in the last 12 months.",
        ),
      ],
    };
  }

  if (profile.hasRevolvingCredit === false) {
    return {
      primary: "thin_file",
      secondary: [],
      confidence: "medium",
      factors: [
        factor(
          "no_revolving_credit",
          "Limited revolving-credit evidence",
          "You told us you do not currently have a credit card or other revolving credit.",
        ),
      ],
    };
  }

  const optimisationFactors: DiagnosisFactor[] = [];
  if (profile.hasRevolvingCredit === true && profile.utilisationPct !== null && profile.utilisationPct > 30) {
    optimisationFactors.push(
      factor(
        "utilisation_above_planning_range",
        "Credit utilisation",
        `You reported ${profile.utilisationPct}% utilisation, above the Credit Quest 30% planning range.`,
      ),
    );
  }
  if (hardApplications !== null && hardApplications >= 2) {
    optimisationFactors.push(
      factor(
        "multiple_recent_applications",
        "Recent applications",
        `You reported ${hardApplications} hard credit applications in the last 6 months.`,
      ),
    );
  }

  if (profile.hasRevolvingCredit === true && optimisationFactors.length > 0) {
    return {
      primary: "optimiser",
      secondary: [],
      confidence: "medium",
      factors: optimisationFactors,
    };
  }

  const knownFactors: DiagnosisFactor[] = [];
  if (missedPayments === 1) {
    knownFactors.push(
      factor(
        "single_missed_payment",
        "Recent payment history",
        "You reported one missed payment in the last 12 months.",
      ),
    );
  }
  if (profile.hasRevolvingCredit === null) {
    knownFactors.push(
      factor(
        "revolving_credit_unknown",
        "Credit history detail needed",
        "We do not yet know whether you have revolving credit.",
      ),
    );
  }

  return {
    primary: null,
    secondary: [],
    confidence: "low",
    factors: knownFactors,
  };
}

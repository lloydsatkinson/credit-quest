import type {
  ApplicationReadiness,
  CreditPassport,
  CreditProfile,
  PassportPillar,
  PassportStatus,
} from "@/lib/domain/types";

function identityPillar(profile: CreditProfile): PassportPillar {
  if (profile.electoralRoll === true) {
    return {
      id: "identity",
      title: "Identity & Traceability",
      status: "green",
      strength: "A useful current-address identity signal is in place.",
      helping: ["You told us you are on the electoral roll at your current address."],
      hurting: [],
      unknowns: [],
      nextActions: [],
    };
  }

  if (profile.electoralRoll === false) {
    return {
      id: "identity",
      title: "Identity & Traceability",
      status: "amber",
      strength: "There is an address-verification signal you may be able to improve.",
      helping: [],
      hurting: ["You told us you are not on the electoral roll at your current address."],
      unknowns: [],
      nextActions: ["If you are eligible, check the official electoral-registration route for your current address."],
    };
  }

  return {
    id: "identity",
    title: "Identity & Traceability",
    status: "unknown",
    strength: "We need one more identity-and-address signal.",
    helping: [],
    hurting: [],
    unknowns: ["We do not yet know your electoral-roll status at your current address."],
    nextActions: ["Check whether you are registered at your current address if you are eligible to register."],
  };
}

function paymentHealthPillar(profile: CreditProfile): PassportPillar {
  let status: PassportStatus;
  let strength: string;
  const helping: string[] = [];
  const hurting: string[] = [];
  const unknowns: string[] = [];
  const nextActions: string[] = [];

  if (profile.missedPaymentsLast12m === null) {
    status = "unknown";
    strength = "Recent payment performance is not yet known.";
    unknowns.push("We do not yet know whether you have missed payments in the last 12 months.");
    nextActions.push("Check your recent payment history so this pillar can use a known answer.");
  } else if (profile.missedPaymentsLast12m >= 2) {
    status = "red";
    strength = "Recent payment problems are the main concern in this pillar.";
    hurting.push(`You reported ${profile.missedPaymentsLast12m} missed payments in the last 12 months.`);
    nextActions.push("Prioritise keeping every current payment up to date and preventing another missed payment.");
  } else if (profile.missedPaymentsLast12m === 1) {
    status = "amber";
    strength = "Most recent payments may be stable, but one missed payment still needs care.";
    hurting.push("You reported one missed payment in the last 12 months.");
    nextActions.push("Protect upcoming payments and keep the next payment cycle on time.");
  } else {
    status = "green";
    strength = "You reported no missed payments in the last 12 months.";
    helping.push("No missed payments were reported in the last 12 months.");
  }

  if (profile.hasRevolvingCredit === true) {
    if (profile.hasDirectDebitForCredit === true) {
      helping.push("You reported direct-debit payment protection on your revolving credit.");
    } else if (profile.hasDirectDebitForCredit === false) {
      hurting.push("You reported no direct-debit payment protection on your revolving credit.");
      nextActions.push("Consider setting up an appropriate payment safeguard for the account.");
    } else {
      unknowns.push("We do not yet know whether your revolving-credit payments are protected by direct debit.");
    }
  }

  return {
    id: "payment_health",
    title: "Payment Health",
    status,
    strength,
    helping,
    hurting,
    unknowns,
    nextActions,
  };
}

function debtHeadroomPillar(profile: CreditProfile): PassportPillar {
  if (profile.hasRevolvingCredit !== true) {
    return {
      id: "debt_headroom",
      title: "Debt & Headroom",
      status: "unknown",
      strength: "Credit Quest does not yet have usable revolving-credit headroom data.",
      helping: [],
      hurting: [],
      unknowns: [
        profile.hasRevolvingCredit === false
          ? "You told us you do not currently have revolving credit, so utilisation is not a meaningful measure yet."
          : "We do not yet know whether you have revolving credit.",
      ],
      nextActions: [],
    };
  }

  if (profile.utilisationPct === null) {
    return {
      id: "debt_headroom",
      title: "Debt & Headroom",
      status: "unknown",
      strength: "We need your current utilisation before assessing this pillar.",
      helping: [],
      hurting: [],
      unknowns: ["Your revolving-credit utilisation is currently unknown."],
      nextActions: ["Check your current balances and total credit limits so you can estimate utilisation."],
    };
  }

  if (profile.utilisationPct > 75) {
    return {
      id: "debt_headroom",
      title: "Debt & Headroom",
      status: "red",
      strength: "Your reported utilisation is high within the Credit Quest planning framework.",
      helping: [],
      hurting: [`You reported ${profile.utilisationPct}% utilisation, above the Credit Quest 75% high-utilisation planning band.`],
      unknowns: [],
      nextActions: ["Reduce utilisation where affordable and practical without creating payment stress elsewhere."],
    };
  }

  if (profile.utilisationPct > 30) {
    return {
      id: "debt_headroom",
      title: "Debt & Headroom",
      status: "amber",
      strength: "There is room to improve your available-credit headroom.",
      helping: [],
      hurting: [`You reported ${profile.utilisationPct}% utilisation, above the Credit Quest 30% planning range.`],
      unknowns: [],
      nextActions: ["Work towards lower utilisation where affordable and practical."],
    };
  }

  return {
    id: "debt_headroom",
    title: "Debt & Headroom",
    status: "green",
    strength: "Your reported utilisation is within the Credit Quest planning range.",
    helping: [`You reported ${profile.utilisationPct}% utilisation, at or below the Credit Quest 30% planning range.`],
    hurting: [],
    unknowns: [],
    nextActions: [],
  };
}

function affordabilityPillar(): PassportPillar {
  return {
    id: "affordability_stability",
    title: "Affordability & Stability",
    status: "unknown",
    strength: "Not assessed with the current data.",
    helping: [],
    hurting: [],
    unknowns: ["Employment, broad income and housing context are not enough for Credit Quest to assess affordability responsibly."],
    nextActions: ["Credit Quest will only score this pillar when more appropriate affordability evidence is available."],
  };
}

function readinessPillar(readiness: ApplicationReadiness): PassportPillar {
  const helping = readiness.state === "green" ? readiness.reasons : [];
  const hurting = readiness.state === "red" || readiness.state === "amber" ? readiness.reasons : [];
  const unknowns = readiness.state === "unknown" ? readiness.reasons : [];

  return {
    id: "application_readiness",
    title: "Application Readiness",
    status: readiness.state,
    strength: readiness.headline,
    helping,
    hurting,
    unknowns,
    nextActions: readiness.actions,
  };
}

export function buildCreditPassport(
  profile: CreditProfile,
  readiness: ApplicationReadiness,
): CreditPassport {
  return {
    pillars: [
      identityPillar(profile),
      paymentHealthPillar(profile),
      debtHeadroomPillar(profile),
      affordabilityPillar(),
      readinessPillar(readiness),
    ],
  };
}

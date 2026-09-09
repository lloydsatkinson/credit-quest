import type {
  RecoveryTreatmentClass,
  SolveabilityClass,
} from "../lib/recovery/decline-taxonomy";
import {
  resolveRecoveryBarriers,
  type BarrierResolution,
} from "../lib/recovery/multi-barrier-resolver";

export const SYNTHETIC_PILOT_DISTRIBUTION = {
  recent_ccj: 9,
  active_insolvency: 9,
  cais_8_9: 9,
  early_delinquency: 9,
  recent_stl_search_velocity: 9,
  thin_no_hit: 9,
  data_integrity: 9,
  high_dsr: 9,
  negative_disposable_income: 9,
  product_limit_mismatch: 9,
  multi_decline: 10,
} as const;

export type SyntheticPilotCategory = keyof typeof SYNTHETIC_PILOT_DISTRIBUTION;
export type SyntheticPilotTransitionKind = "evidence" | "time" | "blocked";

export interface SyntheticPilotTransition {
  kind: SyntheticPilotTransitionKind;
  seedKey: string;
  seedValue: string | number | boolean;
  effectiveAfterDays: number | null;
}

export interface SyntheticPilotExpectedOutcome {
  primaryReasonCode: string;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  alternativeRoutePotential: boolean;
  requiresIndependentReadiness: true;
}

export interface SyntheticRecoveryPilotScenario {
  scenarioId: string;
  synthetic: true;
  pilotType: "synthetic";
  environment: "sandbox";
  originReference: string;
  category: SyntheticPilotCategory;
  reasonCodes: string[];
  transition: SyntheticPilotTransition;
  expected: SyntheticPilotExpectedOutcome;
}

interface CategoryBlueprint {
  category: SyntheticPilotCategory;
  reasonSets: readonly (readonly string[])[];
  transition: SyntheticPilotTransition | ((resolution: BarrierResolution) => SyntheticPilotTransition);
}

const TIME = (seedKey: string, effectiveAfterDays: number): SyntheticPilotTransition => ({
  kind: "time",
  seedKey,
  seedValue: true,
  effectiveAfterDays,
});

const EVIDENCE = (seedKey: string): SyntheticPilotTransition => ({
  kind: "evidence",
  seedKey,
  seedValue: true,
  effectiveAfterDays: null,
});

const BLOCKED = (seedKey: string): SyntheticPilotTransition => ({
  kind: "blocked",
  seedKey,
  seedValue: false,
  effectiveAfterDays: null,
});

function multiTransition(resolution: BarrierResolution): SyntheticPilotTransition {
  const primary = resolution.primary;
  if (!primary) return BLOCKED("missing_primary_reason");
  if (primary.solveability === "structural_long_horizon" || primary.restricted) {
    return BLOCKED("higher_order_blocker_remains_active");
  }
  if (primary.solveability === "time_bound") {
    return TIME("governed_wait_period_elapsed", 90);
  }
  if (primary.riskFamily === "affordability") {
    return EVIDENCE("sustainable_affordability_evidence_confirmed");
  }
  return EVIDENCE("governed_recovery_evidence_confirmed");
}

const BLUEPRINTS: readonly CategoryBlueprint[] = [
  {
    category: "recent_ccj",
    reasonSets: [["CCJ_RECENT"]],
    transition: TIME("recent_ccj_wait_period_elapsed", 180),
  },
  {
    category: "active_insolvency",
    reasonSets: [["ACTIVE_IVA"], ["ACTIVE_BANKRUPTCY"], ["ACTIVE_DRO"]],
    transition: BLOCKED("active_insolvency_cleared"),
  },
  {
    category: "cais_8_9",
    reasonSets: [["CAIS_8_9_RECENT"]],
    transition: TIME("cais_8_9_wait_period_elapsed", 180),
  },
  {
    category: "early_delinquency",
    reasonSets: [["EARLY_DELINQUENCY"]],
    transition: EVIDENCE("stable_payment_evidence_confirmed"),
  },
  {
    category: "recent_stl_search_velocity",
    reasonSets: [
      ["RECENT_STL_ACTIVITY"],
      ["EXCESSIVE_RECENT_SEARCHES"],
      ["MULTIPLE_ACCOUNTS_OPENED_RECENTLY"],
    ],
    transition: TIME("credit_seeking_wait_period_elapsed", 90),
  },
  {
    category: "thin_no_hit",
    reasonSets: [["THIN_FILE"], ["NO_HIT_FILE"], ["INSUFFICIENT_CREDIT_HISTORY"]],
    transition: EVIDENCE("credit_history_evidence_added"),
  },
  {
    category: "data_integrity",
    reasonSets: [["CAIS_DUPLICATE"], ["NOC_DATA_ISSUE"], ["BUREAU_DATA_DISCREPANCY"]],
    transition: EVIDENCE("bureau_data_correction_confirmed"),
  },
  {
    category: "high_dsr",
    reasonSets: [["DSR_HIGH"]],
    transition: EVIDENCE("sustainable_commitments_improved"),
  },
  {
    category: "negative_disposable_income",
    reasonSets: [["NEGATIVE_DISPOSABLE_INCOME"]],
    transition: EVIDENCE("positive_disposable_income_evidence_confirmed"),
  },
  {
    category: "product_limit_mismatch",
    reasonSets: [
      ["PRODUCT_LIMIT_MISMATCH"],
      ["REQUESTED_LIMIT_TOO_HIGH"],
      ["REQUESTED_AMOUNT_TOO_HIGH"],
    ],
    transition: EVIDENCE("fresh_credit_quest_readiness_evidence_confirmed"),
  },
  {
    category: "multi_decline",
    reasonSets: [
      ["DSR_HIGH", "THIN_FILE"],
      ["PRODUCT_LIMIT_MISMATCH", "NEGATIVE_DISPOSABLE_INCOME"],
      ["CAIS_DUPLICATE", "THIN_FILE"],
      ["EARLY_DELINQUENCY", "CAIS_DUPLICATE"],
      ["CCJ_RECENT", "THIN_FILE"],
      ["PRODUCT_LIMIT_MISMATCH", "CAIS_DUPLICATE"],
      ["ACTIVE_IVA", "PRODUCT_LIMIT_MISMATCH"],
      ["RECENT_STL_ACTIVITY", "THIN_FILE"],
      ["CAIS_8_9_RECENT", "NOC_DATA_ISSUE"],
      ["DSR_HIGH", "PRODUCT_LIMIT_MISMATCH", "CAIS_DUPLICATE"],
    ],
    transition: multiTransition,
  },
];

function allResolvedBarriers(resolution: BarrierResolution) {
  return [
    ...(resolution.primary ? [resolution.primary] : []),
    ...resolution.secondary,
    ...resolution.parallel,
  ];
}

function expectedOutcome(resolution: BarrierResolution): SyntheticPilotExpectedOutcome {
  const primary = resolution.primary;
  if (!primary?.canonicalCode) {
    throw new Error("Synthetic pilot scenarios must resolve to a canonical primary reason");
  }

  const barriers = allResolvedBarriers(resolution);
  const alternativeRoutePotential = !resolution.alternativeCreditSuppressed
    && !barriers.some((barrier) => barrier.restricted || barrier.solveability === "unknown_or_unmapped")
    && barriers.some((barrier) => barrier.solveability === "product_routeable");

  return {
    primaryReasonCode: primary.canonicalCode,
    treatment: primary.treatment,
    solveability: primary.solveability,
    alternativeRoutePotential,
    requiresIndependentReadiness: true,
  };
}

function scenarioFor(
  blueprint: CategoryBlueprint,
  categoryIndex: number,
  globalIndex: number,
): SyntheticRecoveryPilotScenario {
  const reasonCodes = [...blueprint.reasonSets[categoryIndex % blueprint.reasonSets.length]];
  const resolution = resolveRecoveryBarriers({ reasonCodes });
  const transition = typeof blueprint.transition === "function"
    ? blueprint.transition(resolution)
    : { ...blueprint.transition };
  const serial = String(globalIndex + 1).padStart(3, "0");

  return {
    scenarioId: `v2-3-synthetic-${serial}`,
    synthetic: true,
    pilotType: "synthetic",
    environment: "sandbox",
    originReference: `synthetic-v2-3-${serial}`,
    category: blueprint.category,
    reasonCodes,
    transition,
    expected: expectedOutcome(resolution),
  };
}

export function buildSyntheticRecoveryPilotScenarios(): SyntheticRecoveryPilotScenario[] {
  const scenarios: SyntheticRecoveryPilotScenario[] = [];
  for (const blueprint of BLUEPRINTS) {
    const count = SYNTHETIC_PILOT_DISTRIBUTION[blueprint.category];
    for (let index = 0; index < count; index += 1) {
      scenarios.push(scenarioFor(blueprint, index, scenarios.length));
    }
  }

  if (scenarios.length !== 100) {
    throw new Error(`Synthetic V2.3 cohort must contain exactly 100 scenarios, received ${scenarios.length}`);
  }
  return scenarios;
}

export interface SyntheticPilotSink {
  recordScenario(scenario: SyntheticRecoveryPilotScenario): Promise<void>;
}

export async function runSyntheticRecoveryPilot(input: {
  environment: "sandbox";
  sink?: SyntheticPilotSink;
}) {
  if (input.environment !== "sandbox") {
    throw new Error("Synthetic V2.3 pilot is sandbox-only");
  }

  const scenarios = buildSyntheticRecoveryPilotScenarios();
  if (input.sink) {
    for (const scenario of scenarios) {
      await input.sink.recordScenario(scenario);
    }
  }

  return {
    synthetic: true as const,
    pilotType: "synthetic" as const,
    environment: "sandbox" as const,
    scenarioCount: scenarios.length,
    scenarios,
  };
}

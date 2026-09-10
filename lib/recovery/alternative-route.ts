import type { AgeMode } from "@/lib/domain/types";
import type { SafetyMode } from "@/lib/domain/safety";
import type { ConditionResult } from "@/lib/recovery/condition-language";
import type { BarrierResolution, ResolvedBarrier } from "@/lib/recovery/multi-barrier-resolver";
import type { RecoveryReadinessState } from "@/lib/recovery/types";

export type AlternativeRouteBlockReason =
  | "alternative_policy_unavailable"
  | "alternative_policy_inactive"
  | "alternative_decline_not_routeable_or_unknown"
  | "alternative_restricted_decision"
  | "alternative_affordability_blocker"
  | "alternative_structural_blocker"
  | "under_18"
  | "safe_mode"
  | "missing_evidence"
  | "readiness_not_ready_to_check"
  | "customer_did_not_continue"
  | "alternative_condition_not_met"
  | "alternative_wait_not_complete"
  | "alternative_contract_unavailable"
  | "alternative_contract_mismatch"
  | "contract_disabled"
  | "contract_expired";

export interface AlternativeRouteGatePolicy {
  id: string;
  canonicalCode: string;
  destinationProductKey: string;
  returnContractId: string | null;
  conditionResult: ConditionResult;
  minimumWaitComplete: boolean;
  active?: boolean;
}

export interface AlternativeRouteGateContract {
  id: string;
  enabled: boolean;
  expiresAt: string;
}

export type AlternativeRouteDecision =
  | { permitted: true; policyId: string; destinationProductKey: string }
  | { permitted: false; reason: AlternativeRouteBlockReason };

export interface AlternativeRoutePolicyInput {
  policy: AlternativeRouteGatePolicy | null;
  barrierResolution: BarrierResolution;
  ageMode: AgeMode;
  safetyMode: SafetyMode;
  evidenceComplete: boolean;
  readinessState: RecoveryReadinessState;
  customerChoice: "continue" | "decline";
  contract: AlternativeRouteGateContract | null;
  now: Date;
}

function allBarriers(resolution: BarrierResolution): ResolvedBarrier[] {
  return [
    ...(resolution.primary ? [resolution.primary] : []),
    ...resolution.secondary,
    ...resolution.parallel,
  ];
}

export function evaluateAlternativeRoutePolicy(
  input: AlternativeRoutePolicyInput,
): AlternativeRouteDecision {
  if (!input.policy) return { permitted: false, reason: "alternative_policy_unavailable" };

  const barriers = allBarriers(input.barrierResolution);
  if (barriers.some((barrier) => barrier.restricted)) {
    return { permitted: false, reason: "alternative_restricted_decision" };
  }
  if (barriers.some((barrier) => barrier.solveability === "structural_long_horizon")) {
    return { permitted: false, reason: "alternative_structural_blocker" };
  }
  if (barriers.some((barrier) => barrier.riskFamily === "affordability" && barrier.treatment !== "fix")) {
    return { permitted: false, reason: "alternative_affordability_blocker" };
  }
  if (barriers.some((barrier) => barrier.solveability === "unknown_or_unmapped")) {
    return { permitted: false, reason: "alternative_decline_not_routeable_or_unknown" };
  }

  const routeableReason = barriers.find((barrier) => (
    barrier.canonicalCode === input.policy?.canonicalCode
    && barrier.solveability === "product_routeable"
  ));
  if (!routeableReason) {
    return { permitted: false, reason: "alternative_decline_not_routeable_or_unknown" };
  }

  if (input.ageMode !== "adult") return { permitted: false, reason: "under_18" };
  if (input.safetyMode === "safe_mode") return { permitted: false, reason: "safe_mode" };
  if (!input.evidenceComplete) return { permitted: false, reason: "missing_evidence" };
  if (input.readinessState !== "ready_to_check") {
    return { permitted: false, reason: "readiness_not_ready_to_check" };
  }
  if (input.customerChoice !== "continue") {
    return { permitted: false, reason: "customer_did_not_continue" };
  }
  if (input.policy.active === false) return { permitted: false, reason: "alternative_policy_inactive" };
  if (input.policy.conditionResult !== true) {
    return { permitted: false, reason: "alternative_condition_not_met" };
  }
  if (!input.policy.minimumWaitComplete) {
    return { permitted: false, reason: "alternative_wait_not_complete" };
  }
  if (!input.policy.returnContractId || !input.contract) {
    return { permitted: false, reason: "alternative_contract_unavailable" };
  }
  if (input.contract.id !== input.policy.returnContractId) {
    return { permitted: false, reason: "alternative_contract_mismatch" };
  }
  if (!input.contract.enabled) return { permitted: false, reason: "contract_disabled" };

  const expiresAt = Date.parse(input.contract.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= input.now.getTime()) {
    return { permitted: false, reason: "contract_expired" };
  }

  return {
    permitted: true,
    policyId: input.policy.id,
    destinationProductKey: input.policy.destinationProductKey,
  };
}

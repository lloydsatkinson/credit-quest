import type {
  ReturnGateContext,
  ReturnGateResult,
} from "@/lib/recovery/types";

function contractExpired(context: ReturnGateContext): boolean {
  const expiry = Date.parse(context.contractExpiresAt);
  return !Number.isFinite(expiry) || expiry <= context.now.getTime();
}

export function evaluateReturnToOriginGate(
  context: ReturnGateContext,
): ReturnGateResult {
  if (!context.enabled) return { permitted: false, reason: "gateway_disabled" };
  if (context.environment === "live" && !context.liveAllowed) {
    return { permitted: false, reason: "live_not_allowed" };
  }
  if (context.ageMode !== "adult") return { permitted: false, reason: "under_18" };
  if (context.safetyMode === "safe_mode") return { permitted: false, reason: "safe_mode" };
  if (!context.evidenceComplete) return { permitted: false, reason: "missing_evidence" };
  if (context.readinessState !== "ready_to_check") {
    return { permitted: false, reason: "readiness_not_ready_to_check" };
  }
  if (!context.cooldownComplete) return { permitted: false, reason: "cooldown_active" };
  if (!context.suppressionClear) return { permitted: false, reason: "suppressed" };
  if (!context.disclosureCurrent) return { permitted: false, reason: "disclosure_stale" };
  if (!context.customerChoseReturn) {
    return { permitted: false, reason: "customer_choice_missing" };
  }
  if (!context.partnerEnabled || !context.partnerEnvironmentEnabled) {
    return { permitted: false, reason: "partner_disabled" };
  }
  if (!context.contractEnabled) return { permitted: false, reason: "contract_disabled" };
  if (context.contractEnvironment !== context.environment) {
    return { permitted: false, reason: "environment_not_permitted" };
  }
  if (contractExpired(context)) return { permitted: false, reason: "contract_expired" };
  return { permitted: true };
}

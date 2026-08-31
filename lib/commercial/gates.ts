import type { CommercialGateContext, CommercialGateResult } from "@/lib/commercial/types";
import type { CreditProfile } from "@/lib/domain/types";

export function hasRequiredCommercialEvidence(profile: CreditProfile): boolean {
  if (profile.missedPaymentsLast12m === null) return false;
  if (profile.hardApplicationsLast6m === null) return false;
  if (profile.hasRevolvingCredit === null) return false;
  if (profile.hasRevolvingCredit === true && profile.utilisationPct === null) return false;
  return true;
}

export function evaluateCommercialPresentationGate(
  context: CommercialGateContext,
): CommercialGateResult {
  if (!context.gatewayEnabled) return { permitted: false, reason: "gateway_disabled" };
  if (context.environment === "live" && !context.liveAllowed) {
    return { permitted: false, reason: "live_not_allowed" };
  }
  if (context.ageMode !== "adult") return { permitted: false, reason: "under_18" };
  if (context.safetyMode === "safe_mode") return { permitted: false, reason: "safe_mode" };
  if (context.readinessState !== "green") {
    return { permitted: false, reason: "readiness_not_green" };
  }
  if (!context.evidenceComplete) return { permitted: false, reason: "missing_evidence" };
  if (!context.partnerEnabled || !context.partnerEnvironmentEnabled) {
    return { permitted: false, reason: "partner_disabled" };
  }
  if (!context.routeEnabled) return { permitted: false, reason: "route_disabled" };
  if (context.routeEnvironment !== context.environment) {
    return { permitted: false, reason: "environment_not_permitted" };
  }
  if (!context.disclosurePresent) return { permitted: false, reason: "disclosure_missing" };
  return { permitted: true };
}

export function evaluateCommercialReferralGate(
  context: CommercialGateContext & { consent: boolean },
): CommercialGateResult {
  const presentation = evaluateCommercialPresentationGate(context);
  if (!presentation.permitted) return presentation;
  if (context.consent !== true) return { permitted: false, reason: "consent_missing" };
  return { permitted: true };
}

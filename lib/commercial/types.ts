import type { ReadinessState } from "@/lib/domain/types";

export type CommercialEnvironment = "sandbox" | "live";

export interface CommercialPartner {
  id: string;
  partnerKey: string;
  displayName: string;
  enabled: boolean;
  sandboxEnabled: boolean;
  liveEnabled: boolean;
}

export interface CommercialRoute {
  id: string;
  routeKey: string;
  partnerId: string;
  partnerKey: string;
  partnerDisplayName: string;
  environment: CommercialEnvironment;
  destinationUrl: string;
  enabled: boolean;
  disclosureKey: string;
}

export interface CommercialDisclosure {
  id: string;
  disclosureKey: string;
  version: number;
  body: string;
}

export type CommercialGateReason =
  | "gateway_disabled"
  | "live_not_allowed"
  | "under_18"
  | "safe_mode"
  | "readiness_not_green"
  | "missing_evidence"
  | "partner_disabled"
  | "route_disabled"
  | "environment_not_permitted"
  | "disclosure_missing"
  | "consent_missing";

export type CommercialGateResult =
  | { permitted: true }
  | { permitted: false; reason: CommercialGateReason };

export interface CommercialGateContext {
  gatewayEnabled: boolean;
  liveAllowed: boolean;
  environment: CommercialEnvironment;
  ageMode: "adult" | "education";
  safetyMode: "normal" | "caution" | "safe_mode";
  readinessState: ReadinessState;
  evidenceComplete: boolean;
  partnerEnabled: boolean;
  partnerEnvironmentEnabled: boolean;
  routeEnabled: boolean;
  routeEnvironment: CommercialEnvironment;
  disclosurePresent: boolean;
}

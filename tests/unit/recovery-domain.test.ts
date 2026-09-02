import { describe, expect, it } from "vitest";
import { buildDeclineContext } from "@/lib/recovery/decline-context";
import { toRecoveryReadinessState } from "@/lib/recovery/readiness";
import { deriveSupportAdaptations } from "@/lib/recovery/support";
import { evaluateReturnToOriginGate } from "@/lib/recovery/return-gate";

const allowedReturn = {
  enabled: true,
  liveAllowed: false,
  environment: "sandbox" as const,
  ageMode: "adult" as const,
  safetyMode: "normal" as const,
  evidenceComplete: true,
  readinessState: "ready_to_check" as const,
  cooldownComplete: true,
  suppressionClear: true,
  disclosureCurrent: true,
  customerChoseReturn: true,
  partnerEnabled: true,
  partnerEnvironmentEnabled: true,
  contractEnabled: true,
  contractEnvironment: "sandbox" as const,
  contractExpiresAt: "2026-10-01T00:00:00.000Z",
  now: new Date("2026-09-02T12:00:00.000Z"),
};

describe("decline recovery domain invariants", () => {
  it("keeps an unknown direct decline reason unknown instead of inventing a cause", () => {
    const context = buildDeclineContext({
      origin: "direct",
      productCategory: "credit_card",
      declinedAt: "2026-09-01T15:30:00.000Z",
      providerName: "Example Bank",
      declineReasonProvided: false,
      declineReasonCode: "SHOULD_NOT_SURVIVE",
      declineReasonSource: "customer",
      additionalSupportMayBeNeeded: null,
    });

    expect(context.reason).toEqual({
      known: false,
      code: null,
      source: "unknown",
    });
    expect(context).not.toHaveProperty("diagnosis");
    expect(context).not.toHaveProperty("profilePatch");
  });

  it("preserves a partner-provided reason as attributed context only", () => {
    const context = buildDeclineContext({
      origin: "partner",
      productCategory: "credit_card",
      declinedAt: "2026-09-01T15:30:00.000Z",
      providerName: "Example Bank",
      declineReasonProvided: true,
      declineReasonCode: "AFFORDABILITY",
      declineReasonSource: "partner",
      additionalSupportMayBeNeeded: true,
    });

    expect(context.reason).toEqual({
      known: true,
      code: "AFFORDABILITY",
      source: "partner",
    });
    expect(context.additionalSupportMayBeNeeded).toBe(true);
    expect(context).not.toHaveProperty("diagnosis");
    expect(context).not.toHaveProperty("readiness");
  });

  it("maps existing readiness semantics into recovery ready-to-check semantics", () => {
    expect(toRecoveryReadinessState("red")).toBe("not_ready");
    expect(toRecoveryReadinessState("amber")).toBe("getting_closer");
    expect(toRecoveryReadinessState("green")).toBe("ready_to_check");
    expect(toRecoveryReadinessState("unknown")).toBe("unknown");
  });

  it("turns functional support needs into adaptations without making a Safe Mode decision", () => {
    const adaptations = deriveSupportAdaptations([
      "simpler_explanations",
      "larger_text",
      "fewer_steps",
      "more_time",
      "human_support",
    ]);

    expect(adaptations).toEqual({
      simplerExplanations: true,
      largerText: true,
      fewerSteps: true,
      moreTime: true,
      reducedMotion: false,
      reminderSupport: false,
      humanSupport: true,
      digitalSupport: false,
      consequentialActionConfirmation: true,
    });
    expect(adaptations).not.toHaveProperty("safeMode");
    expect(adaptations).not.toHaveProperty("suppressOffers");
  });

  it("allows a fully gated sandbox Return-to-Origin case", () => {
    expect(evaluateReturnToOriginGate(allowedReturn)).toEqual({ permitted: true });
  });

  it("fails closed across every independent Return-to-Origin gate", () => {
    expect(evaluateReturnToOriginGate({ ...allowedReturn, enabled: false }))
      .toEqual({ permitted: false, reason: "gateway_disabled" });
    expect(evaluateReturnToOriginGate({
      ...allowedReturn,
      environment: "live",
      contractEnvironment: "live",
    })).toEqual({ permitted: false, reason: "live_not_allowed" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, ageMode: "education" }))
      .toEqual({ permitted: false, reason: "under_18" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, safetyMode: "safe_mode" }))
      .toEqual({ permitted: false, reason: "safe_mode" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, evidenceComplete: false }))
      .toEqual({ permitted: false, reason: "missing_evidence" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, readinessState: "getting_closer" }))
      .toEqual({ permitted: false, reason: "readiness_not_ready_to_check" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, cooldownComplete: false }))
      .toEqual({ permitted: false, reason: "cooldown_active" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, suppressionClear: false }))
      .toEqual({ permitted: false, reason: "suppressed" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, disclosureCurrent: false }))
      .toEqual({ permitted: false, reason: "disclosure_stale" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, customerChoseReturn: false }))
      .toEqual({ permitted: false, reason: "customer_choice_missing" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, partnerEnabled: false }))
      .toEqual({ permitted: false, reason: "partner_disabled" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, partnerEnvironmentEnabled: false }))
      .toEqual({ permitted: false, reason: "partner_disabled" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, contractEnabled: false }))
      .toEqual({ permitted: false, reason: "contract_disabled" });
    expect(evaluateReturnToOriginGate({ ...allowedReturn, contractEnvironment: "live" }))
      .toEqual({ permitted: false, reason: "environment_not_permitted" });
    expect(evaluateReturnToOriginGate({
      ...allowedReturn,
      contractExpiresAt: "2026-09-02T11:59:59.000Z",
    })).toEqual({ permitted: false, reason: "contract_expired" });
  });
});

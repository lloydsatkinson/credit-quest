import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { isReturnSuppressionClear } from "@/lib/server/return-origin-repository";

function adminForSnapshot(input: {
  policySnapshot?: unknown;
  error?: Error | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: input.policySnapshot === undefined
      ? null
      : { policy_snapshot: input.policySnapshot },
    error: input.error ?? null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    admin: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
  };
}

const ordinarySnapshot = {
  schemaVersion: 1,
  partnerId: "partner-1",
  productCategory: "credit_card",
  capturedAt: "2026-09-03T09:00:00.000Z",
  contextConfirmation: "confirmed",
  customerCorrectionCode: null,
  usePartnerReasonsForTreatment: true,
  partnerReasons: [{
    externalCode: "THIN",
    mappingId: "mapping-1",
    mappingVersion: 1,
    canonicalCode: "THIN_FILE",
    treatment: "build",
    solveability: "build_evidence",
    restricted: false,
    parameters: {},
    templateId: "template-1",
    templateVersion: 1,
    reassessmentRuleId: null,
    reassessmentRuleVersion: null,
    alternativeRoutePolicyIds: [],
  }],
  unmappedExternalCodes: [],
};

describe("V2.3 Return-to-Origin restricted-decision suppression", () => {
  it("suppresses the normal return path when the immutable snapshot contains any restricted reason", async () => {
    const { admin, from, select, eq } = adminForSnapshot({
      policySnapshot: {
        ...ordinarySnapshot,
        usePartnerReasonsForTreatment: false,
        contextConfirmation: "optional_use_declined",
        partnerReasons: [{
          ...ordinarySnapshot.partnerReasons[0],
          externalCode: "FRAUD",
          canonicalCode: "FRAUD_SECURITY_DECISION",
          treatment: "restricted",
          solveability: "restricted",
          restricted: true,
        }],
      },
    });

    await expect(isReturnSuppressionClear(
      admin,
      "user-1",
      "recovery-1",
      new Date("2026-09-03T09:00:00.000Z"),
    )).resolves.toBe(false);

    expect(from).toHaveBeenCalledWith("recovery_policy_snapshots");
    expect(select).toHaveBeenCalledWith("policy_snapshot");
    expect(eq).toHaveBeenCalledWith("recovery_journey_id", "recovery-1");
  });

  it("keeps the return path clear for a non-restricted frozen snapshot", async () => {
    const { admin } = adminForSnapshot({ policySnapshot: ordinarySnapshot });
    await expect(isReturnSuppressionClear(
      admin,
      "user-1",
      "recovery-1",
      new Date("2026-09-03T09:00:00.000Z"),
    )).resolves.toBe(true);
  });

  it("preserves legacy partner journeys with no V2.3 policy snapshot", async () => {
    const { admin } = adminForSnapshot({});
    await expect(isReturnSuppressionClear(
      admin,
      "user-1",
      "recovery-1",
      new Date("2026-09-03T09:00:00.000Z"),
    )).resolves.toBe(true);
  });

  it("fails closed on snapshot query errors or malformed snapshot data", async () => {
    const failed = adminForSnapshot({ error: new Error("snapshot lookup failed") });
    await expect(isReturnSuppressionClear(
      failed.admin,
      "user-1",
      "recovery-1",
      new Date("2026-09-03T09:00:00.000Z"),
    )).rejects.toThrow(/snapshot lookup failed/i);

    const malformed = adminForSnapshot({ policySnapshot: { schemaVersion: 1 } });
    await expect(isReturnSuppressionClear(
      malformed.admin,
      "user-1",
      "recovery-1",
      new Date("2026-09-03T09:00:00.000Z"),
    )).rejects.toThrow(/invalid_recovery_policy_snapshot/i);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRecoveryBarriers } from "@/lib/recovery/multi-barrier-resolver";
import {
  recoverySnapshotBarrierReasonCodes,
  type RecoveryPolicySnapshot,
} from "@/lib/recovery/policy-snapshot";

const collisionSnapshot: RecoveryPolicySnapshot = {
  schemaVersion: 1,
  partnerId: "partner-1",
  productCategory: "credit_card",
  capturedAt: "2026-09-09T10:00:00.000Z",
  contextConfirmation: "confirmed",
  customerCorrectionCode: null,
  usePartnerReasonsForTreatment: true,
  partnerReasons: [{
    // This is deliberately the text of a real CQ canonical code, but the
    // activation snapshot says it was NOT mapped. It must stay unknown.
    externalCode: "THIN_FILE",
    mappingId: null,
    mappingVersion: null,
    canonicalCode: null,
    treatment: "needs_evidence",
    solveability: "unknown_or_unmapped",
    restricted: false,
    parameters: {},
    templateId: null,
    templateVersion: null,
    reassessmentRuleId: null,
    reassessmentRuleVersion: null,
    alternativeRoutePolicyIds: [],
  }],
  unmappedExternalCodes: ["THIN_FILE"],
};

describe("V2.3 unmapped decline reason integrity", () => {
  it("never promotes an unmapped raw lender code into a canonical Credit Quest reason", () => {
    const reasonCodes = recoverySnapshotBarrierReasonCodes(collisionSnapshot);
    expect(reasonCodes).toHaveLength(1);
    expect(reasonCodes[0]).not.toBe("THIN_FILE");

    const resolution = resolveRecoveryBarriers({ reasonCodes });
    expect(resolution.primary?.canonicalCode).toBeNull();
    expect(resolution.primary?.treatment).toBe("needs_evidence");
    expect(resolution.primary?.solveability).toBe("unknown_or_unmapped");
  });

  it("requires every snapshot-to-resolver consumer to use the guarded canonical-code helper", () => {
    for (const path of [
      "lib/server/recovery-orchestrator.ts",
      "lib/server/return-origin-repository.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).toContain("recoverySnapshotBarrierReasonCodes(snapshot)");
      expect(source).not.toContain("reason.canonicalCode ?? reason.externalCode");
    }
  });
});

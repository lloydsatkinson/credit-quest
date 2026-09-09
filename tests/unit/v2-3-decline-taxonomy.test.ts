import { describe, expect, it } from "vitest";
import {
  CANONICAL_DECLINE_REASONS,
  getCanonicalDeclineReason,
} from "@/lib/recovery/decline-taxonomy";

describe("V2.3 canonical decline taxonomy", () => {
  it("classifies negative disposable income as affordability and not product fit", () => {
    const reason = getCanonicalDeclineReason("NEGATIVE_DISPOSABLE_INCOME");
    expect(reason).toMatchObject({
      riskFamily: "affordability",
      treatment: "create_headroom",
      solveability: "stabilise_first",
      alternativeCreditPermittedByDefault: false,
    });
  });

  it("keeps score cutoff declines non-diagnostic", () => {
    const reason = getCanonicalDeclineReason("SCORE_CUTOFF");
    expect(reason).toMatchObject({
      riskFamily: "policy_or_score",
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
      inferRootCause: false,
    });
  });

  it("marks fraud and AML outcomes as restricted non-recovery", () => {
    expect(getCanonicalDeclineReason("FRAUD_SECURITY_DECISION")).toMatchObject({
      riskFamily: "restricted",
      treatment: "restricted",
      solveability: "restricted",
      restricted: true,
    });
    expect(getCanonicalDeclineReason("AML_RESTRICTED_DECISION")?.restricted).toBe(true);
  });

  it("treats thin file as evidence building, not adverse credit", () => {
    expect(getCanonicalDeclineReason("THIN_FILE")).toMatchObject({
      riskFamily: "file_depth",
      treatment: "build",
      solveability: "build_evidence",
      alternativeCreditPermittedByDefault: false,
    });
  });

  it("treats a CAIS duplicate as a correctable data issue", () => {
    expect(getCanonicalDeclineReason("CAIS_DUPLICATE")).toMatchObject({
      riskFamily: "data_integrity",
      treatment: "fix",
      solveability: "fix_now",
    });
  });

  it("keeps active IVA and Scottish protected-trust-deed states structural", () => {
    expect(getCanonicalDeclineReason("ACTIVE_IVA")?.solveability).toBe("structural_long_horizon");
    expect(getCanonicalDeclineReason("ACTIVE_PROTECTED_TRUST_DEED")?.solveability).toBe("structural_long_horizon");
  });

  it("marks product limit mismatch as routeable only in principle", () => {
    expect(getCanonicalDeclineReason("PRODUCT_LIMIT_MISMATCH")).toMatchObject({
      riskFamily: "product_fit",
      treatment: "find_a_better_fit",
      solveability: "product_routeable",
      alternativeCreditPermittedByDefault: true,
    });
  });

  it("has unique canonical codes", () => {
    const codes = CANONICAL_DECLINE_REASONS.map((reason) => reason.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

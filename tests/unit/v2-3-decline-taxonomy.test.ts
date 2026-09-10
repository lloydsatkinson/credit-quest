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

  it("contains every canonical code explicitly approved by the V2.3 design", () => {
    const approvedCodes = [
      "CCJ_RECENT",
      "CCJ_ACTIVE_UNSATISFIED",
      "DEFAULT_RECENT",
      "CAIS_8_9_RECENT",
      "MORTGAGE_DEFAULT",
      "MORTGAGE_ARREARS_MATERIAL",
      "ACTIVE_IVA",
      "ACTIVE_BANKRUPTCY",
      "RECENT_BANKRUPTCY",
      "ACTIVE_DRO",
      "RECENT_INSOLVENCY",
      "ACTIVE_PROTECTED_TRUST_DEED",
      "ACTIVE_SEQUESTRATION",
      "ACTIVE_DAS",
      "ACTIVE_DMP",
      "ARRANGEMENT_TO_PAY_ACTIVE",
      "EARLY_DELINQUENCY",
      "ACTIVE_ARREARS",
      "MISSED_PAYMENT_RECENT",
      "CAIS_3_6_RECENT",
      "DETERIORATING_EXTERNAL_PERFORMANCE",
      "INTERNAL_ARREARS",
      "RETURNED_PAYMENT_RECENT",
      "RECENT_STL_ACTIVITY",
      "MULTIPLE_STL_RECENT",
      "HIGH_COST_CREDIT_RECENT",
      "EXCESSIVE_RECENT_SEARCHES",
      "NEW_ACCOUNT_VELOCITY",
      "MULTIPLE_ACCOUNTS_OPENED_RECENTLY",
      "RECENT_APPLICATION_COOLDOWN",
      "DSR_HIGH",
      "NEGATIVE_DISPOSABLE_INCOME",
      "LOW_DISPOSABLE_INCOME",
      "ESSENTIAL_EXPENDITURE_FAILURE",
      "HIGH_TOTAL_COMMITMENTS",
      "OPEN_BANKING_AFFORDABILITY_FAIL",
      "INCOME_INSUFFICIENT_FOR_REQUEST",
      "INCOME_UNVERIFIED",
      "INCOME_MISMATCH",
      "INCOME_INSTABILITY",
      "EMPLOYMENT_INSTABILITY",
      "RECURRING_ACCOUNT_SHORTFALL",
      "UNSECURED_DEBT_HIGH",
      "AGGREGATE_EXPOSURE_HIGH",
      "UTILISATION_HIGH",
      "REVOLVING_BALANCE_HIGH",
      "PERSISTENT_OVERDRAFT_USE",
      "UNARRANGED_OVERDRAFT_FREQUENT",
      "OVERLIMIT_BEHAVIOUR",
      "CASH_ADVANCE_BEHAVIOUR",
      "EXISTING_CUSTOMER_EXPOSURE_LIMIT",
      "THIN_FILE",
      "NO_HIT_FILE",
      "INSUFFICIENT_CREDIT_HISTORY",
      "LIMITED_UK_FOOTPRINT",
      "NEW_TO_UK_LIMITED_HISTORY",
      "INSUFFICIENT_ESTABLISHED_ACCOUNTS",
      "CAIS_DUPLICATE",
      "NOC_DATA_ISSUE",
      "SPECIAL_INSTRUCTION_REVIEW",
      "BUREAU_DATA_DISCREPANCY",
      "ADDRESS_FILE_MISMATCH",
      "IDENTITY_FILE_MISMATCH",
      "ELECTORAL_ROLL_EVIDENCE_GAP",
      "CII_EXCLUSION_OR_FILE_SUPPRESSION",
      "BUREAU_ASSOCIATION_DATA_REVIEW",
      "PREVIOUS_INTERNAL_DEFAULT",
      "PREVIOUS_WRITE_OFF",
      "INTERNAL_DELINQUENCY_HISTORY",
      "PRIOR_ACCOUNT_TERMINATION",
      "INTERNAL_RISK_POLICY_HISTORY",
      "RISK_SCORE_BELOW_CUTOFF",
      "INTERNAL_SCORE_BELOW_CUTOFF",
      "AFFORDABILITY_SCORE_BELOW_CUTOFF",
      "SCORE_DECLINE_UNEXPLAINED",
      "REQUESTED_LIMIT_TOO_HIGH",
      "REQUESTED_AMOUNT_TOO_HIGH",
      "TERM_MISMATCH",
      "PRODUCT_LIMIT_MISMATCH",
      "MINIMUM_LIMIT_NOT_MET",
      "TOTAL_EXPOSURE_PRODUCT_LIMIT",
      "PRODUCT_POLICY_MISMATCH",
      "LENDER_POLICY_EXCLUSION",
      "RESIDENCY_POLICY_NOT_MET",
      "PRODUCT_AGE_POLICY_NOT_MET",
    ];

    const codes = new Set(CANONICAL_DECLINE_REASONS.map((reason) => reason.code));
    for (const code of approvedCodes) expect(codes.has(code), code).toBe(true);
  });

  it("has unique canonical codes", () => {
    const codes = CANONICAL_DECLINE_REASONS.map((reason) => reason.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

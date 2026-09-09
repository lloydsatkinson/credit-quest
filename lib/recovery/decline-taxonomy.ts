export type DeclineRiskFamily =
  | "public_adverse"
  | "delinquency"
  | "credit_seeking"
  | "affordability"
  | "indebtedness"
  | "file_depth"
  | "data_integrity"
  | "internal_performance"
  | "product_fit"
  | "policy_or_score"
  | "restricted";

export type RecoveryTreatmentClass =
  | "fix"
  | "build"
  | "stabilise"
  | "create_headroom"
  | "wait_and_rebuild"
  | "longer_term_recovery"
  | "find_a_better_fit"
  | "needs_evidence"
  | "restricted";

export type SolveabilityClass =
  | "fix_now"
  | "build_evidence"
  | "stabilise_first"
  | "time_bound"
  | "structural_long_horizon"
  | "product_routeable"
  | "unknown_or_unmapped"
  | "restricted";

export interface CanonicalDeclineReasonDefinition {
  code: string;
  riskFamily: DeclineRiskFamily;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  restricted: boolean;
  inferRootCause: boolean;
  alternativeCreditPermittedByDefault: boolean;
  customerLanguageKey: string;
}

type ReasonOverrides = Partial<Omit<CanonicalDeclineReasonDefinition, "code" | "riskFamily" | "treatment" | "solveability" | "customerLanguageKey">>;

function reason(
  code: string,
  riskFamily: DeclineRiskFamily,
  treatment: RecoveryTreatmentClass,
  solveability: SolveabilityClass,
  customerLanguageKey: string,
  overrides: ReasonOverrides = {},
): CanonicalDeclineReasonDefinition {
  return {
    code,
    riskFamily,
    treatment,
    solveability,
    customerLanguageKey,
    restricted: false,
    inferRootCause: true,
    alternativeCreditPermittedByDefault: false,
    ...overrides,
  };
}

const PUBLIC_ADVERSE: CanonicalDeclineReasonDefinition[] = [
  reason("CCJ_RECENT", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("CCJ_ACTIVE_UNSATISFIED", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("DEFAULT_RECENT", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("CAIS_8_9_RECENT", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("MORTGAGE_DEFAULT", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("MORTGAGE_ARREARS_MATERIAL", "public_adverse", "stabilise", "stabilise_first", "stabilise"),
  reason("ACTIVE_IVA", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("ACTIVE_BANKRUPTCY", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("RECENT_BANKRUPTCY", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("ACTIVE_DRO", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("RECENT_INSOLVENCY", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("ACTIVE_PROTECTED_TRUST_DEED", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("ACTIVE_SEQUESTRATION", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("ACTIVE_DAS", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("ACTIVE_DMP", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("ARRANGEMENT_TO_PAY_ACTIVE", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("RECENT_PROTECTED_TRUST_DEED", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("RECENT_SEQUESTRATION", "public_adverse", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("ACTIVE_MINIMAL_ASSET_PROCESS", "public_adverse", "longer_term_recovery", "structural_long_horizon", "longer_term"),
];

const DELINQUENCY: CanonicalDeclineReasonDefinition[] = [
  reason("EARLY_DELINQUENCY", "delinquency", "stabilise", "stabilise_first", "stabilise"),
  reason("ACTIVE_ARREARS", "delinquency", "stabilise", "stabilise_first", "stabilise"),
  reason("MISSED_PAYMENT_RECENT", "delinquency", "wait_and_rebuild", "time_bound", "recent_adverse"),
  reason("CAIS_3_6_RECENT", "delinquency", "stabilise", "stabilise_first", "stabilise"),
  reason("DETERIORATING_EXTERNAL_PERFORMANCE", "delinquency", "stabilise", "stabilise_first", "stabilise"),
  reason("INTERNAL_ARREARS", "delinquency", "stabilise", "stabilise_first", "stabilise"),
  reason("RETURNED_PAYMENT_RECENT", "delinquency", "stabilise", "stabilise_first", "stabilise"),
];

const CREDIT_SEEKING: CanonicalDeclineReasonDefinition[] = [
  reason("RECENT_STL_ACTIVITY", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("MULTIPLE_STL_RECENT", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("HIGH_COST_CREDIT_RECENT", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("EXCESSIVE_RECENT_SEARCHES", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("NEW_ACCOUNT_VELOCITY", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("MULTIPLE_ACCOUNTS_OPENED_RECENTLY", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("RECENT_APPLICATION_COOLDOWN", "credit_seeking", "wait_and_rebuild", "time_bound", "needs_time"),
];

const AFFORDABILITY: CanonicalDeclineReasonDefinition[] = [
  reason("DSR_HIGH", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("NEGATIVE_DISPOSABLE_INCOME", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("LOW_DISPOSABLE_INCOME", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("ESSENTIAL_EXPENDITURE_FAILURE", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("HIGH_TOTAL_COMMITMENTS", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("OPEN_BANKING_AFFORDABILITY_FAIL", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("INCOME_INSUFFICIENT_FOR_REQUEST", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("INCOME_UNVERIFIED", "affordability", "fix", "fix_now", "data_check"),
  reason("INCOME_MISMATCH", "affordability", "fix", "fix_now", "data_check"),
  reason("INCOME_INSTABILITY", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("EMPLOYMENT_INSTABILITY", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
  reason("RECURRING_ACCOUNT_SHORTFALL", "affordability", "create_headroom", "stabilise_first", "create_headroom"),
];

const INDEBTEDNESS: CanonicalDeclineReasonDefinition[] = [
  reason("UNSECURED_DEBT_HIGH", "indebtedness", "create_headroom", "stabilise_first", "create_headroom"),
  reason("AGGREGATE_EXPOSURE_HIGH", "indebtedness", "create_headroom", "stabilise_first", "create_headroom"),
  reason("UTILISATION_HIGH", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("REVOLVING_BALANCE_HIGH", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("PERSISTENT_OVERDRAFT_USE", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("UNARRANGED_OVERDRAFT_FREQUENT", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("OVERLIMIT_BEHAVIOUR", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("CASH_ADVANCE_BEHAVIOUR", "indebtedness", "stabilise", "stabilise_first", "stabilise"),
  reason("EXISTING_CUSTOMER_EXPOSURE_LIMIT", "indebtedness", "create_headroom", "stabilise_first", "create_headroom"),
];

const FILE_DEPTH: CanonicalDeclineReasonDefinition[] = [
  reason("THIN_FILE", "file_depth", "build", "build_evidence", "build_evidence"),
  reason("NO_HIT_FILE", "file_depth", "build", "build_evidence", "build_evidence"),
  reason("INSUFFICIENT_CREDIT_HISTORY", "file_depth", "build", "build_evidence", "build_evidence"),
  reason("LIMITED_UK_FOOTPRINT", "file_depth", "build", "build_evidence", "build_evidence"),
  reason("NEW_TO_UK_LIMITED_HISTORY", "file_depth", "build", "build_evidence", "build_evidence"),
  reason("INSUFFICIENT_ESTABLISHED_ACCOUNTS", "file_depth", "build", "build_evidence", "build_evidence"),
];

const DATA_INTEGRITY: CanonicalDeclineReasonDefinition[] = [
  reason("CAIS_DUPLICATE", "data_integrity", "fix", "fix_now", "data_check"),
  reason("NOC_DATA_ISSUE", "data_integrity", "fix", "fix_now", "data_check"),
  reason("SPECIAL_INSTRUCTION_REVIEW", "data_integrity", "fix", "fix_now", "data_check"),
  reason("BUREAU_DATA_DISCREPANCY", "data_integrity", "fix", "fix_now", "data_check"),
  reason("ADDRESS_FILE_MISMATCH", "data_integrity", "fix", "fix_now", "data_check"),
  reason("IDENTITY_FILE_MISMATCH", "data_integrity", "fix", "fix_now", "data_check"),
  reason("ELECTORAL_ROLL_EVIDENCE_GAP", "data_integrity", "fix", "fix_now", "data_check"),
  reason("CII_EXCLUSION_OR_FILE_SUPPRESSION", "data_integrity", "fix", "fix_now", "data_check"),
  reason("BUREAU_ASSOCIATION_DATA_REVIEW", "data_integrity", "fix", "fix_now", "data_check"),
];

const INTERNAL_PERFORMANCE: CanonicalDeclineReasonDefinition[] = [
  reason("PREVIOUS_INTERNAL_DEFAULT", "internal_performance", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("PREVIOUS_WRITE_OFF", "internal_performance", "longer_term_recovery", "structural_long_horizon", "longer_term"),
  reason("INTERNAL_DELINQUENCY_HISTORY", "internal_performance", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("PRIOR_ACCOUNT_TERMINATION", "internal_performance", "wait_and_rebuild", "time_bound", "needs_time"),
  reason("INTERNAL_RISK_POLICY_HISTORY", "internal_performance", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
];

const PRODUCT_FIT: CanonicalDeclineReasonDefinition[] = [
  reason("REQUESTED_LIMIT_TOO_HIGH", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("REQUESTED_AMOUNT_TOO_HIGH", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("TERM_MISMATCH", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("PRODUCT_LIMIT_MISMATCH", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("MINIMUM_LIMIT_NOT_MET", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("TOTAL_EXPOSURE_PRODUCT_LIMIT", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("PRODUCT_POLICY_MISMATCH", "product_fit", "find_a_better_fit", "product_routeable", "better_fit", { alternativeCreditPermittedByDefault: true }),
  reason("LENDER_POLICY_EXCLUSION", "product_fit", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("RESIDENCY_POLICY_NOT_MET", "product_fit", "needs_evidence", "unknown_or_unmapped", "eligibility_policy", { inferRootCause: false }),
  reason("PRODUCT_AGE_POLICY_NOT_MET", "product_fit", "needs_evidence", "unknown_or_unmapped", "eligibility_policy", { inferRootCause: false }),
];

const POLICY_OR_SCORE: CanonicalDeclineReasonDefinition[] = [
  reason("RISK_SCORE_BELOW_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("INTERNAL_SCORE_BELOW_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("AFFORDABILITY_SCORE_BELOW_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("SCORE_DECLINE_UNEXPLAINED", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("SCORE_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("CREDIT_RISK_SCORE_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("AFFORDABILITY_SCORE_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("POLICY_SCORE_CUTOFF", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
  reason("GENERIC_CREDIT_POLICY_DECLINE", "policy_or_score", "needs_evidence", "unknown_or_unmapped", "need_more_information", { inferRootCause: false }),
];

const RESTRICTED: CanonicalDeclineReasonDefinition[] = [
  reason("FRAUD_SECURITY_DECISION", "restricted", "restricted", "restricted", "restricted_decision", {
    restricted: true,
    inferRootCause: false,
  }),
  reason("AML_RESTRICTED_DECISION", "restricted", "restricted", "restricted", "restricted_decision", {
    restricted: true,
    inferRootCause: false,
  }),
  reason("SANCTIONS_RESTRICTED_DECISION", "restricted", "restricted", "restricted", "restricted_decision", {
    restricted: true,
    inferRootCause: false,
  }),
  reason("KYC_RESTRICTED_DECISION", "restricted", "restricted", "restricted", "restricted_decision", {
    restricted: true,
    inferRootCause: false,
  }),
  reason("OTHER_SECURITY_RESTRICTED_DECISION", "restricted", "restricted", "restricted", "restricted_decision", {
    restricted: true,
    inferRootCause: false,
  }),
];

export const CANONICAL_DECLINE_REASONS: readonly CanonicalDeclineReasonDefinition[] = [
  ...PUBLIC_ADVERSE,
  ...DELINQUENCY,
  ...CREDIT_SEEKING,
  ...AFFORDABILITY,
  ...INDEBTEDNESS,
  ...FILE_DEPTH,
  ...DATA_INTEGRITY,
  ...INTERNAL_PERFORMANCE,
  ...PRODUCT_FIT,
  ...POLICY_OR_SCORE,
  ...RESTRICTED,
];

const BY_CODE = new Map(CANONICAL_DECLINE_REASONS.map((definition) => [definition.code, definition]));

export function getCanonicalDeclineReason(code: string): CanonicalDeclineReasonDefinition | null {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return null;
  return BY_CODE.get(normalised) ?? null;
}

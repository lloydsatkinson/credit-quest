import {
  getCanonicalDeclineReason,
  type DeclineRiskFamily,
  type RecoveryTreatmentClass,
  type SolveabilityClass,
} from "@/lib/recovery/decline-taxonomy";

export interface ResolvedBarrier {
  code: string;
  canonicalCode: string | null;
  riskFamily: DeclineRiskFamily | null;
  treatment: RecoveryTreatmentClass;
  solveability: SolveabilityClass;
  restricted: boolean;
}

export interface BarrierResolution {
  primary: ResolvedBarrier | null;
  secondary: ResolvedBarrier[];
  parallel: ResolvedBarrier[];
  treatment: RecoveryTreatmentClass;
  alternativeCreditSuppressed: boolean;
  suppressionReason: string | null;
}

export interface ResolveRecoveryBarriersInput {
  reasonCodes: string[];
}

type PrecedenceRule = (barrier: ResolvedBarrier) => boolean;

const PRECEDENCE: readonly PrecedenceRule[] = [
  (barrier) => barrier.restricted,
  (barrier) => barrier.solveability === "structural_long_horizon",
  (barrier) => barrier.riskFamily === "affordability" && barrier.treatment !== "fix",
  (barrier) => barrier.solveability === "stabilise_first",
  (barrier) => barrier.solveability === "time_bound",
  (barrier) => barrier.solveability === "product_routeable",
  (barrier) => barrier.solveability === "unknown_or_unmapped",
  (barrier) => barrier.solveability === "build_evidence",
  (barrier) => barrier.solveability === "fix_now",
];

function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

function resolveBarrier(code: string): ResolvedBarrier | null {
  const normalised = normaliseCode(code);
  if (!normalised) return null;

  const canonical = getCanonicalDeclineReason(normalised);
  if (!canonical) {
    return {
      code: normalised,
      canonicalCode: null,
      riskFamily: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
      restricted: false,
    };
  }

  return {
    code: canonical.code,
    canonicalCode: canonical.code,
    riskFamily: canonical.riskFamily,
    treatment: canonical.treatment,
    solveability: canonical.solveability,
    restricted: canonical.restricted,
  };
}

function precedenceIndex(barrier: ResolvedBarrier): number {
  const index = PRECEDENCE.findIndex((rule) => rule(barrier));
  return index === -1 ? PRECEDENCE.length : index;
}

function canRunInParallel(barrier: ResolvedBarrier): boolean {
  return barrier.riskFamily === "data_integrity" || barrier.riskFamily === "file_depth";
}

function suppressionFor(barriers: readonly ResolvedBarrier[]): string | null {
  if (barriers.some((barrier) => barrier.restricted)) return "restricted decision";
  if (barriers.some((barrier) => barrier.solveability === "structural_long_horizon")) return "structural recovery blocker";
  if (barriers.some((barrier) => barrier.riskFamily === "affordability" && barrier.treatment !== "fix")) return "affordability blocker";
  return null;
}

export function resolveRecoveryBarriers(input: ResolveRecoveryBarriersInput): BarrierResolution {
  const seen = new Set<string>();
  const barriers = input.reasonCodes
    .map(resolveBarrier)
    .filter((barrier): barrier is ResolvedBarrier => Boolean(barrier))
    .filter((barrier) => {
      if (seen.has(barrier.code)) return false;
      seen.add(barrier.code);
      return true;
    });

  if (barriers.length === 0) {
    return {
      primary: null,
      secondary: [],
      parallel: [],
      treatment: "needs_evidence",
      alternativeCreditSuppressed: false,
      suppressionReason: null,
    };
  }

  const sorted = barriers
    .map((barrier, inputIndex) => ({ barrier, inputIndex }))
    .sort((left, right) => precedenceIndex(left.barrier) - precedenceIndex(right.barrier) || left.inputIndex - right.inputIndex)
    .map(({ barrier }) => barrier);

  const normalCandidates = sorted.filter((barrier) => !canRunInParallel(barrier));
  const primary = normalCandidates[0] ?? sorted[0];
  const parallel = normalCandidates.length > 0
    ? sorted.filter((barrier) => barrier !== primary && canRunInParallel(barrier))
    : [];
  const secondary = sorted.filter((barrier) => barrier !== primary && !parallel.includes(barrier));
  const suppressionReason = suppressionFor(barriers);

  return {
    primary,
    secondary,
    parallel,
    treatment: primary.treatment,
    alternativeCreditSuppressed: suppressionReason !== null,
    suppressionReason,
  };
}

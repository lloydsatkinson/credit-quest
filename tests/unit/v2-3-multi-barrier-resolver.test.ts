import { describe, expect, it } from "vitest";
import { resolveRecoveryBarriers } from "@/lib/recovery/multi-barrier-resolver";

describe("V2.3 deterministic multi-barrier resolver", () => {
  it("makes active structural insolvency outrank product routing", () => {
    const result = resolveRecoveryBarriers({ reasonCodes: ["PRODUCT_LIMIT_MISMATCH", "ACTIVE_IVA"] });
    expect(result.primary?.code).toBe("ACTIVE_IVA");
    expect(result.treatment).toBe("longer_term_recovery");
    expect(result.alternativeCreditSuppressed).toBe(true);
  });

  it("makes negative disposable income outrank a lower-limit product route", () => {
    const result = resolveRecoveryBarriers({ reasonCodes: ["REQUESTED_LIMIT_TOO_HIGH", "NEGATIVE_DISPOSABLE_INCOME"] });
    expect(result.primary?.code).toBe("NEGATIVE_DISPOSABLE_INCOME");
    expect(result.treatment).toBe("create_headroom");
    expect(result.alternativeCreditSuppressed).toBe(true);
    expect(result.suppressionReason).toMatch(/affordability/i);
  });

  it("orders affordability first while retaining time-bound and thin-file work", () => {
    const result = resolveRecoveryBarriers({ reasonCodes: ["THIN_FILE", "RECENT_STL_ACTIVITY", "DSR_HIGH"] });
    expect(result.primary?.code).toBe("DSR_HIGH");
    expect(result.secondary.map((barrier) => barrier.code)).toContain("RECENT_STL_ACTIVITY");
    expect(result.parallel.map((barrier) => barrier.code)).toContain("THIN_FILE");
  });

  it("keeps data correction parallel unless it is the only meaningful barrier", () => {
    const combined = resolveRecoveryBarriers({ reasonCodes: ["CAIS_DUPLICATE", "DSR_HIGH"] });
    expect(combined.primary?.code).toBe("DSR_HIGH");
    expect(combined.parallel.map((barrier) => barrier.code)).toContain("CAIS_DUPLICATE");

    const dataOnly = resolveRecoveryBarriers({ reasonCodes: ["CAIS_DUPLICATE"] });
    expect(dataOnly.primary?.code).toBe("CAIS_DUPLICATE");
    expect(dataOnly.treatment).toBe("fix");
  });

  it("suppresses normal recovery for restricted fraud or security decisions", () => {
    const result = resolveRecoveryBarriers({ reasonCodes: ["PRODUCT_LIMIT_MISMATCH", "FRAUD_SECURITY_DECISION"] });
    expect(result.primary?.code).toBe("FRAUD_SECURITY_DECISION");
    expect(result.treatment).toBe("restricted");
    expect(result.alternativeCreditSuppressed).toBe(true);
    expect(result.suppressionReason).toMatch(/restricted/i);
  });

  it("preserves unmapped reasons as unknown rather than guessing a cause", () => {
    const result = resolveRecoveryBarriers({ reasonCodes: ["PARTNER_CODE_NOT_MAPPED"] });
    expect(result.primary).toMatchObject({
      code: "PARTNER_CODE_NOT_MAPPED",
      canonicalCode: null,
      treatment: "needs_evidence",
      solveability: "unknown_or_unmapped",
    });
    expect(result.treatment).toBe("needs_evidence");
  });
});

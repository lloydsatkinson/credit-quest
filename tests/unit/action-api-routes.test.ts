import { describe, expect, it } from "vitest";
import { accountInputSchema } from "@/app/api/accounts/route";
import { accountUpdateSchema } from "@/app/api/accounts/[id]/route";

describe("account api validation", () => {
  const valid = {
    providerId: null,
    accountType: "credit_card" as const,
    nickname: "Main card",
    lastFour: "1234",
    balanceMinor: 20000,
    creditLimitMinor: 100000,
    directDebitStatus: "no" as const,
  };

  it("accepts optional last four digits", () => {
    expect(accountInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a client-supplied full card number field", () => {
    expect(accountInputSchema.safeParse({
      ...valid,
      cardNumber: "1234567890123456",
    }).success).toBe(false);
  });

  it("rejects malformed last four digits", () => {
    expect(accountInputSchema.safeParse({ ...valid, lastFour: "123456" }).success).toBe(false);
  });

  it("rejects negative money values", () => {
    expect(accountInputSchema.safeParse({ ...valid, balanceMinor: -1 }).success).toBe(false);
  });

  it("allows a partial owner-account update but no user id override", () => {
    expect(accountUpdateSchema.safeParse({ nickname: "Travel card" }).success).toBe(true);
    expect(accountUpdateSchema.safeParse({ nickname: "Travel card", userId: "someone-else" }).success).toBe(false);
  });
});

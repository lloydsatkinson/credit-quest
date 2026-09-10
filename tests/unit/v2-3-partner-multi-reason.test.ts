import { describe, expect, it, vi } from "vitest";
import {
  normalisePartnerReasonCodes,
  partnerDeclineSchema,
} from "@/lib/recovery/partner-intake-schema";
import { insertPartnerIntakeSession } from "@/lib/server/partner-intake-repository";

const validPayload = {
  originReference: "application-abc-123",
  productCategory: "credit_card" as const,
  declinedAt: "2026-09-02T15:30:00.000Z",
  declineReasonProvided: true,
  declineReasonCode: "DSR_HIGH",
};

describe("V2.3 multi-reason partner decline intake", () => {
  it("accepts up to eight structured decline reason codes", () => {
    const multi = {
      ...validPayload,
      declineReasonCode: null,
      declineReasonCodes: ["DSR_HIGH", "RECENT_STL_ACTIVITY", "THIN_FILE"],
    };

    expect(partnerDeclineSchema.safeParse(multi).success).toBe(true);
    expect(partnerDeclineSchema.safeParse({
      ...multi,
      declineReasonCodes: Array.from({ length: 9 }, (_, index) => `R${index}`),
    }).success).toBe(false);
  });

  it("preserves legacy single-reason payloads and de-duplicates ordered reasons", () => {
    const legacy = partnerDeclineSchema.parse(validPayload);
    expect(normalisePartnerReasonCodes(legacy)).toEqual(["DSR_HIGH"]);

    const multi = partnerDeclineSchema.parse({
      ...validPayload,
      declineReasonCode: "DSR_HIGH",
      declineReasonCodes: ["DSR_HIGH", "THIN_FILE", "DSR_HIGH", "CAIS_DUPLICATE"],
    });
    expect(normalisePartnerReasonCodes(multi)).toEqual([
      "DSR_HIGH",
      "THIN_FILE",
      "CAIS_DUPLICATE",
    ]);
  });

  it("requires at least one actual reason when the partner says a reason was supplied", () => {
    expect(partnerDeclineSchema.safeParse({
      ...validPayload,
      declineReasonCode: null,
      declineReasonCodes: undefined,
    }).success).toBe(false);
  });

  it("persists the session and all reasons through one atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    });
    const admin = { rpc };

    await insertPartnerIntakeSession(admin as never, {
      partnerId: "22222222-2222-4222-8222-222222222222",
      credentialId: "33333333-3333-4333-8333-333333333333",
      returnContractId: null,
      environment: "sandbox",
      originReference: "application-abc-123",
      productCategory: "credit_card",
      declinedAt: "2026-09-02T15:30:00.000Z",
      declineReasonCode: "DSR_HIGH",
      declineReasonCodes: ["DSR_HIGH", "THIN_FILE", "CAIS_DUPLICATE"],
      declineReasonSource: "partner",
      attributionKey: null,
      additionalSupportMayBeNeeded: null,
      disclosureVersion: null,
      consentVersion: null,
      idempotencyKey: "idem-1",
      nonce: "nonce-1",
      requestTimestamp: "2026-09-03T06:30:00.000Z",
      tokenHash: "a".repeat(64),
      tokenExpiresAt: "2026-09-03T06:45:00.000Z",
    } as never);

    expect(rpc).toHaveBeenCalledWith("create_partner_intake_with_reasons_atomic", expect.objectContaining({
      p_decline_reason_code: "DSR_HIGH",
      p_decline_reason_codes: ["DSR_HIGH", "THIN_FILE", "CAIS_DUPLICATE"],
    }));
  });
});

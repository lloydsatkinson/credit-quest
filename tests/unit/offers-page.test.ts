import { describe, expect, it } from "vitest";
import { getMarketplaceOffers } from "@/lib/domain/offer-matcher";
import type { CreditProfile } from "@/lib/domain/types";

const profile: CreditProfile = {
  userId: "u1", dateOfBirth: "1990-01-01", employmentStatus: "employed", incomeBand: "30_50k",
  housingStatus: "rent", electoralRoll: true, utilisationPct: null, missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0, hasRevolvingCredit: false, hasDirectDebitForCredit: false,
};

describe("marketplace age gate", () => {
  const now = new Date("2026-08-25T12:00:00Z");
  it("returns zero credit products for a 17 year old", () => {
    expect(getMarketplaceOffers({ ...profile, dateOfBirth: "2009-08-26" }, now)).toEqual([]);
  });
  it("returns active products for an adult", () => {
    expect(getMarketplaceOffers(profile, now).length).toBeGreaterThan(0);
  });
});

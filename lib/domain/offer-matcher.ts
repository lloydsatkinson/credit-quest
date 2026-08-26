import { OFFER_CATALOGUE } from "@/lib/data/offers";
import { getAgeYears } from "@/lib/domain/age-gate";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile, MissionDefinition, OfferDefinition } from "@/lib/domain/types";

export function getOffersForMission(
  profile: CreditProfile,
  mission: MissionDefinition,
  now = new Date(),
): OfferDefinition[] {
  const safety = assessSafety(profile);
  if (safety.suppressOffers) return [];
  if (!mission.referralCategory) return [];

  const age = getAgeYears(profile.dateOfBirth, now);
  if (age < 18) return [];

  return OFFER_CATALOGUE.filter(
    (offer) => offer.active && offer.category === mission.referralCategory && age >= offer.minAge,
  );
}

export function getMarketplaceOffers(profile: CreditProfile, now = new Date()): OfferDefinition[] {
  const safety = assessSafety(profile);
  if (safety.suppressOffers) return [];

  const age = getAgeYears(profile.dateOfBirth, now);
  if (age < 18) return [];
  return OFFER_CATALOGUE.filter((offer) => offer.active && age >= offer.minAge);
}

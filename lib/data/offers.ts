import type { OfferDefinition } from "@/lib/domain/types";

export const OFFER_CATALOGUE: OfferDefinition[] = [
  {
    id: "demo-credit-builder-1",
    provider: "Example Card Co",
    productName: "Example Credit Builder Card",
    category: "credit_builder_card",
    affiliateUrl: "https://example.com/credit-builder?src=creditquest",
    disclosure: "Partner link — Credit Quest may earn a commission.",
    minAge: 18,
    active: true,
    commissionPence: 3500,
  },
  {
    id: "demo-credit-builder-2",
    provider: "Sample Bank",
    productName: "Sample Starter Card",
    category: "credit_builder_card",
    affiliateUrl: "https://example.org/starter-card?src=creditquest",
    disclosure: "Partner link — Credit Quest may earn a commission.",
    minAge: 18,
    active: true,
    commissionPence: 1200,
  },
];

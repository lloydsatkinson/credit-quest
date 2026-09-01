import { applyCommercialRoutePresentationVariant } from "@/lib/experiments/assignment";

export function orderEquivalentCommercialRoutes<T extends {
  routeKey: string;
  partnerKey: string;
}>(routes: readonly T[]): T[] {
  return [...routes].sort((a, b) =>
    a.routeKey.localeCompare(b.routeKey) || a.partnerKey.localeCompare(b.partnerKey));
}

export function presentEquivalentCommercialRoutes<T extends {
  routeKey: string;
  partnerKey: string;
}>(routes: readonly T[], presentationVariant = "control"): T[] {
  const permitted = orderEquivalentCommercialRoutes(routes);
  return applyCommercialRoutePresentationVariant(permitted, presentationVariant);
}

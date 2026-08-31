export function orderEquivalentCommercialRoutes<T extends {
  routeKey: string;
  partnerKey: string;
}>(routes: readonly T[]): T[] {
  return [...routes].sort((a, b) =>
    a.routeKey.localeCompare(b.routeKey) || a.partnerKey.localeCompare(b.partnerKey));
}

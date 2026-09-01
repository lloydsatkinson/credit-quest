import type { ActiveExperiment, ExperimentVariant } from "@/lib/experiments/types";

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignExperimentVariant(
  experiment: ActiveExperiment,
  userId: string,
): ExperimentVariant {
  const variants = [...experiment.variants].sort((a, b) => a.key.localeCompare(b.key));
  if (variants.length === 0) throw new Error("Experiment has no approved variants");
  return variants[fnv1a(`${userId}:${experiment.experimentKey}`) % variants.length];
}

export function applyCommercialRoutePresentationVariant<T>(
  routes: readonly T[],
  variantKey: string,
): T[] {
  if (variantKey === "reverse") return [...routes].reverse();
  return [...routes];
}

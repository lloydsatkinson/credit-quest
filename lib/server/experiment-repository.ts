import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  approvedPresentationKeys,
  experimentSurfaces,
  type ActiveExperiment,
  type ExperimentSurface,
  type ExperimentVariant,
} from "@/lib/experiments/types";

function isExperimentSurface(value: string): value is ExperimentSurface {
  return experimentSurfaces.includes(value as ExperimentSurface);
}

function parseVariants(surface: ExperimentSurface, value: unknown): ExperimentVariant[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const approved = approvedPresentationKeys[surface];
  const parsed: ExperimentVariant[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const key = String((item as Record<string, unknown>).key ?? "");
    const presentationKey = String((item as Record<string, unknown>).presentationKey ?? "");
    if (!key || seen.has(key) || !approved.includes(presentationKey)) return null;
    seen.add(key);
    parsed.push({ key, presentationKey });
  }
  return parsed;
}

export async function getActiveExperiment(
  admin: SupabaseClient,
  surface: ExperimentSurface,
): Promise<ActiveExperiment | null> {
  try {
    const { data, error } = await admin
      .from("experiments")
      .select("id,experiment_key,status,surface_key,variants")
      .eq("status", "active")
      .eq("surface_key", surface)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const surfaceKey = String(data.surface_key ?? "");
    if (!isExperimentSurface(surfaceKey) || surfaceKey !== surface) return null;
    if (String(data.status ?? "") !== "active") return null;
    const variants = parseVariants(surfaceKey, data.variants);
    if (!variants) return null;

    return {
      id: String(data.id),
      experimentKey: String(data.experiment_key),
      surface: surfaceKey,
      variants,
    };
  } catch {
    return null;
  }
}

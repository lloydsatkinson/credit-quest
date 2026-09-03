import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportNeedCode } from "@/lib/recovery/types";

const SUPPORT_NEED_CODES: readonly SupportNeedCode[] = [
  "simpler_explanations",
  "larger_text",
  "fewer_steps",
  "more_time",
  "reduced_motion",
  "reminder_support",
  "human_support",
  "digital_support",
];

const supportNeedSet = new Set<string>(SUPPORT_NEED_CODES);

function isSupportNeedCode(value: unknown): value is SupportNeedCode {
  return typeof value === "string" && supportNeedSet.has(value);
}

export async function listSupportNeeds(
  client: SupabaseClient,
  userId: string,
): Promise<SupportNeedCode[]> {
  const { data, error } = await client
    .from("support_needs")
    .select("need_code")
    .eq("user_id", userId)
    .eq("confirmation_state", "confirmed")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((row) => (row as Record<string, unknown>).need_code)
    .filter(isSupportNeedCode);
}

export async function replaceSupportNeeds(
  admin: SupabaseClient,
  userId: string,
  needs: readonly SupportNeedCode[],
  now = new Date(),
): Promise<SupportNeedCode[]> {
  const nowIso = now.toISOString();

  const { error: deleteError } = await admin
    .from("support_needs")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (needs.length === 0) return [];

  const { error: insertError } = await admin
    .from("support_needs")
    .insert(
      needs.map((needCode) => ({
        user_id: userId,
        need_code: needCode,
        source: "customer",
        confirmation_state: "confirmed",
        effective_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })),
    );
  if (insertError) throw insertError;

  return [...needs];
}

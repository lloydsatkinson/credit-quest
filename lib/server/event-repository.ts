import type { SupabaseClient } from "@supabase/supabase-js";
import { eventNames } from "@/lib/events";

export type EventName = (typeof eventNames)[number];

export async function recordServerEvent(
  supabase: SupabaseClient,
  userId: string,
  name: EventName,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("events").insert({
      user_id: userId,
      event_name: name,
      metadata,
    });
  } catch {
    // Analytics is deliberately best-effort and must never block an action.
  }
}

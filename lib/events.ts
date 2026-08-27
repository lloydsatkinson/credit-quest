import { z } from "zod";

export const eventNames = [
  "onboarding_started",
  "onboarding_completed",
  "mission_shown",
  "mission_started",
  "mission_completed",
  "mission_deferred",
  "mission_dismissed",
  "offer_shown",
  "offer_clicked",
  "referral_outcome",
  "action_resolved",
  "action_started",
  "action_returned",
  "action_submitted",
  "action_self_confirmed",
  "action_verified",
  "action_cancelled",
] as const;

export const eventPayloadSchema = z.object({
  name: z.enum(eventNames),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export async function trackEvent(name: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const parsed = eventPayloadSchema.safeParse({ name, metadata });
  if (!parsed.success) return;
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the user's core journey.
  }
}

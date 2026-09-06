export const RECOVERY_EVENT_NAMES = [
  "recovery_handoff_created",
  "recovery_activated",
  "recovery_hero_shown",
  "recovery_state_shown",
  "recovery_waiting_for_evidence",
  "recovery_reassessment_due",
  "recovery_first_action",
  "recovery_reassessed",
  "recovery_ready_to_check",
  "recovery_return_choice",
  "recovery_return_blocked",
] as const;

export type RecoveryEventName = typeof RECOVERY_EVENT_NAMES[number];

export interface RecoveryEvent {
  name: RecoveryEventName;
  metadata?: Record<string, unknown>;
}

export type RecoveryEventWriter = (event: RecoveryEvent) => Promise<unknown>;

export async function emitRecoveryEventBestEffort(
  writer: RecoveryEventWriter,
  event: RecoveryEvent,
): Promise<void> {
  try {
    await writer(event);
  } catch {
    // Recovery analytics is observational only. It must never block a valid
    // recovery, reassessment or customer-controlled return action.
  }
}

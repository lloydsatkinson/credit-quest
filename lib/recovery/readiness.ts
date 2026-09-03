import type { ReadinessState } from "@/lib/domain/types";
import type { RecoveryReadinessState } from "@/lib/recovery/types";

export function toRecoveryReadinessState(
  state: ReadinessState,
): RecoveryReadinessState {
  switch (state) {
    case "red":
      return "not_ready";
    case "amber":
      return "getting_closer";
    case "green":
      return "ready_to_check";
    case "unknown":
      return "unknown";
  }
}

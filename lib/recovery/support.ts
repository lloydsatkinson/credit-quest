import type {
  SupportAdaptations,
  SupportNeedCode,
} from "@/lib/recovery/types";

export function deriveSupportAdaptations(
  needs: readonly SupportNeedCode[],
): SupportAdaptations {
  const selected = new Set(needs);
  const fewerSteps = selected.has("fewer_steps");
  const moreTime = selected.has("more_time");
  const humanSupport = selected.has("human_support");

  return {
    simplerExplanations: selected.has("simpler_explanations"),
    largerText: selected.has("larger_text"),
    fewerSteps,
    moreTime,
    reducedMotion: selected.has("reduced_motion"),
    reminderSupport: selected.has("reminder_support"),
    humanSupport,
    digitalSupport: selected.has("digital_support"),
    consequentialActionConfirmation: moreTime || humanSupport || fewerSteps,
  };
}

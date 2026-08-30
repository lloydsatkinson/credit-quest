import type { ApprovedReminderCopyInput } from "@/lib/reminders/types";

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export function renderApprovedReminderTemplate(input: ApprovedReminderCopyInput) {
  const reviewDate = dateLabel(input.dueAt);
  const protective = input.safeMode || input.ageMode === "education";

  const textByTemplate = {
    "mission-incomplete-v1": "Your Credit Quest action is still open. Return when you are ready to continue it.",
    "cooldown-ending-v1": `Your planned waiting period reaches its review point on ${reviewDate}. Return to Credit Quest to reassess the information you have now.`,
    "reassessment-due-v1": "It is time to review your Credit Quest position. Return to see what the current evidence says and what to do next.",
    "readiness-changed-v1": protective
      ? "Your Credit Quest position changed. Return to see the updated guidance and the next safe step."
      : `Your Credit Quest readiness band changed from ${input.readinessBefore ?? "Unknown"} to ${input.readinessAfter ?? "Unknown"}. Return to see the updated guidance. This is not a lender approval prediction.`,
  } as const;

  const text = textByTemplate[input.templateKey];
  return {
    subject: "Your Credit Quest plan is ready to review",
    text,
    html: `<p>${text}</p>`,
  };
}

import type { JourneyOutcome, JourneyState } from "@/lib/journey/types";

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function bandLabel(value: JourneyOutcome["readinessAfter"]): string {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function nextStep(state: JourneyState): string {
  switch (state.stage) {
    case "onboarding":
      return "Finish your profile so Credit Quest can establish the next useful action.";
    case "active_mission":
      return "Keep working through your current mission. We’ll reassess from the evidence you provide.";
    case "cooldown":
      return state.nextReassessmentAt
        ? `Keep the plan steady for now. We’ll reassess on ${dateLabel(state.nextReassessmentAt) ?? "the scheduled review date"}.`
        : "Keep the plan steady for now and follow the next review point shown in your mission.";
    case "reassessment_due":
      return "Your review point has arrived. Credit Quest can reassess using your current information.";
    case "ready":
      return "Continue with the next sensible action and avoid unnecessary applications. Readiness is guidance, not a lender decision.";
    case "optimising":
      return "Your core position is stronger; keep improving the factors Credit Quest can evidence and reassess when something meaningful changes.";
    case "waiting":
    default:
      return state.nextReassessmentAt
        ? `No extra application is needed just to test the market. We’ll reassess on ${dateLabel(state.nextReassessmentAt) ?? "the scheduled review date"}.`
        : "No extra application is needed just to test the market. Follow the next useful mission and reassess when your evidence changes.";
  }
}

function changeLabel(latestOutcome: JourneyOutcome | null): string {
  if (
    latestOutcome?.eventType === "readiness_changed" &&
    latestOutcome.readinessBefore &&
    latestOutcome.readinessAfter
  ) {
    return `${bandLabel(latestOutcome.readinessBefore)} → ${bandLabel(latestOutcome.readinessAfter)}`;
  }

  if (latestOutcome?.eventType === "reassessment_performed") {
    return "Reassessment completed — no readiness change recorded.";
  }

  if (latestOutcome?.eventType === "mission_completed") return "Mission completed.";
  if (latestOutcome?.eventType === "mission_deferred") return "Mission moved to a later review point.";
  if (latestOutcome?.eventType === "cooldown_started") return "Review cooldown started.";
  if (latestOutcome?.eventType === "action_verified") return "Action evidence verified.";
  if (latestOutcome?.eventType === "action_submitted") return "Action submitted.";
  if (latestOutcome?.eventType === "mission_started") return "Mission started.";
  if (latestOutcome?.eventType === "onboarding_completed") return "Profile setup completed.";
  return "Your Journey is ready to track meaningful changes.";
}

export function JourneyStatusCard({
  state,
  latestOutcome,
}: {
  state: JourneyState | null;
  latestOutcome: JourneyOutcome | null;
}) {
  if (!state) return null;

  const reassessmentDate = dateLabel(state.nextReassessmentAt);

  return (
    <section
      data-testid="journey-status"
      className="mb-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Your Credit Quest journey"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Journey update</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">What changed</h2>
        </div>
        {reassessmentDate ? (
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">
            Reassess {reassessmentDate}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-base font-black text-slate-900">{changeLabel(latestOutcome)}</p>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">What happens next</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{nextStep(state)}</p>
      </div>
    </section>
  );
}

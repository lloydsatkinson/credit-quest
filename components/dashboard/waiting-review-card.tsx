function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "your next review date";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function reviewHeadline(missionSlug: string, missionTitle: string): string {
  if (missionSlug === "register-electoral-roll") {
    return "Your electoral-roll registration is in review.";
  }
  if (missionSlug === "build-revolving-history") {
    return "Your revolving-credit update is in review.";
  }

  return `${missionTitle} is in review.`;
}

export function WaitingReviewCard({
  missionSlug,
  missionTitle,
  nextReviewAt,
  reviewCount,
}: {
  missionSlug: string;
  missionTitle: string;
  nextReviewAt: string;
  reviewCount: number;
}) {
  const reviewDate = formatReviewDate(nextReviewAt);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-200">
        Waiting for review
      </span>
      <h2 className="mt-5 text-4xl font-black tracking-tight">
        {reviewHeadline(missionSlug, missionTitle)}
      </h2>
      {reviewCount > 1 ? (
        <p className="mt-3 text-sm font-black text-amber-100">{reviewCount} items currently in review</p>
      ) : null}
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
        We’ve recorded your update. Some real-world changes take time to appear, so Credit Quest is keeping this mission open rather than treating it as complete too early.
      </p>
      <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Next evidence-based review</p>
        <p className="mt-1.5 text-lg font-black text-white">{reviewDate}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">You do not need to repeat this action while we are waiting for that review point.</p>
      </div>
    </div>
  );
}

import { Children, type ReactNode } from "react";

const toneClasses = {
  ink: "border-slate-800 bg-slate-950 text-white shadow-2xl shadow-slate-300/60",
  violet: "border-violet-500/20 bg-violet-600 text-white shadow-2xl shadow-violet-200/60",
  light: "border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-200/70",
  soft: "border-violet-100 bg-violet-50 text-slate-950 shadow-xl shadow-violet-100/70",
} as const;

export function QuestFeed({ children }: { children: ReactNode }) {
  const count = Children.count(children);

  return (
    <section
      data-testid="quest-feed"
      aria-label={`Your personalised Quest Feed, ${count} cards`}
      className="relative"
    >
      <div className="quest-feed-scroll h-[calc(100svh-8.75rem)] min-h-[34rem] space-y-4 overflow-y-auto overscroll-contain rounded-[2rem] snap-y snap-mandatory sm:h-[38rem]">
        {children}
      </div>
      <div className="mt-3 flex items-center justify-between px-2 text-xs font-bold text-slate-500">
        <span>Scroll for your full plan</span>
        <span>{count} cards · finite feed</span>
      </div>
    </section>
  );
}

export function QuestFeedCard({
  eyebrow,
  index,
  total,
  tone = "light",
  children,
}: {
  eyebrow: string;
  index: number;
  total: number;
  tone?: keyof typeof toneClasses;
  children: ReactNode;
}) {
  return (
    <article
      data-quest-feed-card
      aria-label={`${eyebrow}, card ${index} of ${total}`}
      className={`relative flex min-h-[calc(100svh-8.75rem)] snap-start snap-always flex-col overflow-hidden rounded-[2rem] border p-6 sm:min-h-[38rem] sm:p-8 ${toneClasses[tone]}`}
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className={`text-xs font-black uppercase tracking-[0.18em] ${tone === "ink" || tone === "violet" ? "text-white/70" : "text-violet-600"}`}>
          {eyebrow}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${tone === "ink" || tone === "violet" ? "bg-white/10 text-white/75" : "bg-slate-950/5 text-slate-500"}`}>
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <div className={`mt-8 h-1 overflow-hidden rounded-full ${tone === "ink" || tone === "violet" ? "bg-white/10" : "bg-slate-950/5"}`} aria-hidden="true">
        <div
          className={tone === "ink" || tone === "violet" ? "h-full rounded-full bg-white/70" : "h-full rounded-full bg-violet-500"}
          style={{ width: `${Math.round((index / total) * 100)}%` }}
        />
      </div>
    </article>
  );
}

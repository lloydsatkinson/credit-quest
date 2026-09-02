import { Children, type ReactNode } from "react";

const toneClasses = {
  ink: "border-cyan-300/20 bg-[#07101a] text-white shadow-[0_30px_90px_rgba(0,0,0,0.38)]",
  violet: "border-fuchsia-300/15 bg-[#110b20] text-white shadow-[0_30px_90px_rgba(0,0,0,0.38)]",
  light: "border-white/10 bg-[#0a111c] text-white shadow-[0_30px_90px_rgba(0,0,0,0.34)]",
  soft: "border-lime-300/15 bg-[#0b1515] text-white shadow-[0_30px_90px_rgba(0,0,0,0.34)]",
} as const;

const accentClasses = {
  ink: "text-cyan-300",
  violet: "text-fuchsia-300",
  light: "text-cyan-300",
  soft: "text-lime-300",
} as const;

const progressClasses = {
  ink: "from-cyan-300 via-cyan-200 to-lime-300",
  violet: "from-fuchsia-300 via-violet-300 to-cyan-300",
  light: "from-cyan-300 via-violet-300 to-fuchsia-300",
  soft: "from-lime-300 via-emerald-300 to-cyan-300",
} as const;

export function QuestFeed({ children }: { children: ReactNode }) {
  const count = Children.count(children);

  return (
    <section
      data-testid="quest-feed"
      aria-label={`Your personalised Quest Feed, ${count} cards`}
      className="cq-quest-feed relative"
    >
      <div className="quest-feed-scroll h-[calc(100svh-9.25rem)] min-h-[34rem] space-y-3 overflow-y-auto overscroll-contain rounded-[2rem] snap-y snap-mandatory sm:h-[43rem] sm:space-y-4">
        {children}
      </div>
      <div className="mt-3 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="inline-block size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(31,228,255,0.7)]" aria-hidden="true" />Swipe for your plan</span>
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
      data-tone={tone}
      aria-label={`${eyebrow}, card ${index} of ${total}`}
      className={`cq-feed-card relative flex min-h-[calc(100svh-9.25rem)] snap-start snap-always flex-col overflow-hidden rounded-[2rem] border p-5 sm:min-h-[43rem] sm:p-8 ${toneClasses[tone]}`}
    >
      <div className="absolute -right-16 -top-20 size-56 rounded-full bg-cyan-300/[0.035] blur-3xl" aria-hidden="true" />
      <div className="relative mb-7 flex items-center justify-between gap-4">
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${accentClasses[tone]}`}>
          {eyebrow}
        </p>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-black tracking-[0.14em] text-slate-500">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="relative flex flex-1 flex-col">{children}</div>
      <div className="relative mt-7 h-1 overflow-hidden rounded-full bg-white/[0.055]" aria-hidden="true">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${progressClasses[tone]} shadow-[0_0_16px_rgba(31,228,255,0.22)]`}
          style={{ width: `${Math.round((index / total) * 100)}%` }}
        />
      </div>
    </article>
  );
}

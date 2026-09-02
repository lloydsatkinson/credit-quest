import type { ApplicationReadiness, ReadinessState } from "@/lib/domain/types";

const stateClasses: Record<ReadinessState, string> = {
  green: "border-lime-300/20 bg-lime-300/[0.08] text-lime-300",
  amber: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
  red: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200",
  unknown: "border-white/10 bg-white/[0.04] text-slate-400",
};

function stateLabel(state: ReadinessState): string {
  return state === "green" ? "Green" : state === "amber" ? "Amber" : state === "red" ? "Red" : "Unknown";
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="cq-panel rounded-[1.75rem] p-5 sm:p-6">
      <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex gap-2 leading-7 text-slate-300">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-cyan-300/70" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Nothing additional to show here right now.</p>
      )}
    </section>
  );
}

export function ReadinessDetail({ readiness }: { readiness: ApplicationReadiness }) {
  return (
    <section data-testid="readiness-overview" className="cq-panel relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-8">
      <div aria-hidden="true" className="absolute -right-24 -top-24 size-64 rounded-full bg-lime-300/[0.05] blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${stateClasses[readiness.state]}`}>
            {stateLabel(readiness.state)}
          </span>
          <span className="cq-kicker">Application readiness</span>
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">Can I apply yet?</h1>
        <p className="mt-5 text-3xl font-black tracking-[-0.035em] text-white">{readiness.headline}</p>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          This is Credit Quest guidance, not a lender approval prediction. A green result does not mean you will be approved by a lender.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <ListSection title="Why" items={readiness.reasons} />
          <ListSection title="What to avoid" items={readiness.avoid} />
          <ListSection title="What to do next" items={readiness.actions} />
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-sm leading-6 text-slate-400">
          {readiness.reassessAt
            ? `Your next evidence-based reassessment is ${readiness.reassessAt}.`
            : "There is no exact reassessment date yet because Credit Quest does not have dated evidence that would justify a countdown."}
        </div>
      </div>
    </section>
  );
}

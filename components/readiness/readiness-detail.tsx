import type { ApplicationReadiness, ReadinessState } from "@/lib/domain/types";

const stateClasses: Record<ReadinessState, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-rose-100 text-rose-800",
  unknown: "bg-slate-200 text-slate-700",
};

function stateLabel(state: ReadinessState): string {
  return state === "green" ? "Green" : state === "amber" ? "Amber" : state === "red" ? "Red" : "Unknown";
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => <li key={item} className="leading-7 text-slate-700">• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Nothing additional to show here right now.</p>
      )}
    </section>
  );
}

export function ReadinessDetail({ readiness }: { readiness: ApplicationReadiness }) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${stateClasses[readiness.state]}`}>
          {stateLabel(readiness.state)}
        </span>
        <span className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Application readiness</span>
      </div>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Can I apply yet?</h1>
      <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">{readiness.headline}</p>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        This is Credit Quest guidance, not a lender approval prediction. A green result does not mean you will be approved by a lender.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <ListSection title="Why" items={readiness.reasons} />
        <ListSection title="What to avoid" items={readiness.avoid} />
        <ListSection title="What to do next" items={readiness.actions} />
      </div>

      <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
        {readiness.reassessAt
          ? `Your next evidence-based reassessment is ${readiness.reassessAt}.`
          : "There is no exact reassessment date yet because Credit Quest does not have dated evidence that would justify a countdown."}
      </div>
    </section>
  );
}

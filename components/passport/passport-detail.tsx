import type { CreditPassport, PassportPillar, PassportStatus } from "@/lib/domain/types";

const statusClasses: Record<PassportStatus, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-rose-100 text-rose-800",
  unknown: "bg-slate-200 text-slate-700",
};

function statusLabel(status: PassportStatus): string {
  return status === "green" ? "Green" : status === "amber" ? "Amber" : status === "red" ? "Red" : "Unknown";
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-slate-700">• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function PillarDetail({ pillar }: { pillar: PassportPillar }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">{pillar.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.strength}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses[pillar.status]}`}>
          {statusLabel(pillar.status)}
        </span>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <EvidenceList title="What is helping" items={pillar.helping} />
        <EvidenceList title="What is hurting" items={pillar.hurting} />
        <EvidenceList title="What we do not know" items={pillar.unknowns} />
        <EvidenceList title="Next actions" items={pillar.nextActions} />
      </div>
    </article>
  );
}

export function PassportDetail({ passport }: { passport: CreditPassport }) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Your position, explained</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Your Credit Passport</h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">
        This is a Credit Quest guidance framework, not a credit-reference-agency score and not a lender underwriting result.
      </p>
      <div className="mt-8 space-y-4">
        {passport.pillars.map((pillar) => <PillarDetail key={pillar.id} pillar={pillar} />)}
      </div>
    </section>
  );
}

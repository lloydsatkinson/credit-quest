import Link from "next/link";
import type { CreditPassport, PassportPillar, PassportStatus } from "@/lib/domain/types";

const statusClasses: Record<PassportStatus, string> = {
  green: "border-lime-300/20 bg-lime-300/[0.08] text-lime-300",
  amber: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
  red: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200",
  unknown: "border-white/10 bg-white/[0.04] text-slate-400",
};

function statusLabel(status: PassportStatus): string {
  return status === "green" ? "Green" : status === "amber" ? "Amber" : status === "red" ? "Red" : "Unknown";
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300/70" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PillarDetail({ pillar, actionHref }: { pillar: PassportPillar; actionHref?: string }) {
  return (
    <article
      data-testid={`passport-pillar-${pillar.id}`}
      className="cq-panel rounded-[1.75rem] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">{pillar.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{pillar.strength}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${statusClasses[pillar.status]}`}>
          {statusLabel(pillar.status)}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <EvidenceList title="What is helping" items={pillar.helping} />
        <EvidenceList title="What is hurting" items={pillar.hurting} />
        <EvidenceList title="What we do not know" items={pillar.unknowns} />
        <EvidenceList title="Next actions" items={pillar.nextActions} />
      </div>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(200,255,56,0.10)] transition hover:bg-lime-200"
        >
          <span>Take action on {pillar.title}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </article>
  );
}

export function PassportDetail({
  passport,
  actionHrefs = {},
}: {
  passport: CreditPassport;
  actionHrefs?: Partial<Record<PassportPillar["id"], string>>;
}) {
  return (
    <section className="text-white">
      <p className="cq-kicker">Your position, explained</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">Your Credit Passport</h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-400">
        This is a Credit Quest guidance framework, not a credit-reference-agency score and not a lender underwriting result.
      </p>
      <div className="mt-8 space-y-4">
        {passport.pillars.map((pillar) => (
          <PillarDetail key={pillar.id} pillar={pillar} actionHref={actionHrefs[pillar.id]} />
        ))}
      </div>
    </section>
  );
}

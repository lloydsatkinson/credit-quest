import Link from "next/link";
import type { BarrierDiagnosis, BarrierType, CreditPassport, PassportStatus } from "@/lib/domain/types";

const statusClasses: Record<PassportStatus, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-rose-100 text-rose-800",
  unknown: "bg-slate-200 text-slate-700",
};

const focusLabels: Record<BarrierType, string> = {
  credit_invisible: "Understanding your credit footprint",
  thin_file: "Building credit history",
  new_to_uk: "Building UK credit context",
  credit_rebuilder: "Credit rebuilding",
  affordability_constrained: "Strengthening affordability",
  optimiser: "Optimising your profile",
};

function statusLabel(status: PassportStatus): string {
  return status === "green" ? "Green" : status === "amber" ? "Amber" : status === "red" ? "Red" : "Unknown";
}

export function PassportCard({
  passport,
  diagnosis,
}: {
  passport: CreditPassport;
  diagnosis?: BarrierDiagnosis;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Your Credit Passport</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
        Five plain-English signals showing what Credit Quest currently knows about your position.
      </p>
      {diagnosis?.primary ? (
        <div className="mt-4 w-fit rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800">
          Current focus: {focusLabels[diagnosis.primary]}
        </div>
      ) : null}

      <div className="mt-6 divide-y divide-slate-200/80 rounded-3xl border border-slate-200 bg-white/70 px-4 sm:px-5">
        {passport.pillars.map((pillar) => (
          <div key={pillar.id} data-testid="passport-pillar" className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="font-black text-slate-950">{pillar.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{pillar.strength}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses[pillar.status]}`}>
              {statusLabel(pillar.status)}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/passport"
        className="mt-auto pt-6 text-center text-sm font-black text-violet-700 underline decoration-violet-300 underline-offset-4"
      >
        See my full Passport
      </Link>
    </div>
  );
}

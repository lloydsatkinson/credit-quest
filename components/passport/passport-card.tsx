import Link from "next/link";
import type { BarrierDiagnosis, BarrierType, CreditPassport, PassportStatus } from "@/lib/domain/types";

const statusClasses: Record<PassportStatus, string> = {
  green: "border-emerald-300/25 bg-emerald-300/10 text-emerald-300",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-300",
  red: "border-rose-300/25 bg-rose-300/10 text-rose-300",
  unknown: "border-white/10 bg-white/[0.045] text-slate-400",
};

const statusDots: Record<PassportStatus, string> = {
  green: "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.55)]",
  amber: "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]",
  red: "bg-rose-300 shadow-[0_0_12px_rgba(253,164,175,0.45)]",
  unknown: "bg-slate-600",
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
  identityActionHref,
}: {
  passport: CreditPassport;
  diagnosis?: BarrierDiagnosis;
  identityActionHref?: string;
}) {
  const knownSignals = passport.pillars.filter((pillar) => pillar.status !== "unknown").length;
  const identity = passport.pillars.find((pillar) => pillar.id === "identity");
  const canImproveIdentity = Boolean(identityActionHref && identity?.status === "amber");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Five evidence signals</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Your Credit Passport</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
            A plain-English view of what is helping, what needs work and what Credit Quest still does not know.
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[13rem_1fr]">
        <div className="relative mx-auto grid size-48 place-items-center sm:size-52" aria-label={`${knownSignals} of 5 Passport signals currently known`}>
          <div
            className="absolute inset-0 rounded-full p-[10px] shadow-[0_0_60px_rgba(31,228,255,0.08)]"
            style={{
              background: "conic-gradient(from -34deg, #1fe4ff 0 18%, transparent 18% 20%, #c8ff38 20% 38%, transparent 38% 40%, #ff4bb8 40% 58%, transparent 58% 60%, #7c5cff 60% 78%, transparent 78% 80%, #27e6a7 80% 98%, transparent 98%)",
            }}
            aria-hidden="true"
          >
            <div className="size-full rounded-full bg-[#07101a]" />
          </div>
          <div className="relative grid size-36 place-items-center rounded-full border border-white/8 bg-[#090e17] text-center shadow-[inset_0_0_35px_rgba(31,228,255,0.035)] sm:size-40">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Credit</p>
              <p className="text-xl font-black tracking-[-0.06em] text-white">PASSPORT</p>
              <div className="mx-auto my-2 h-px w-16 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <p className="text-xs font-black text-cyan-300">{knownSignals} / 5 known</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-slate-600">Not a credit score</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {passport.pillars.map((pillar) => (
            <div key={pillar.id} data-testid="passport-pillar" className="flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-white/[0.025] px-3.5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${statusDots[pillar.status]}`} aria-hidden="true" />
                  <p className="truncate text-sm font-black text-white">{pillar.title}</p>
                </div>
                <p className="mt-1 line-clamp-1 pl-3.5 text-[11px] leading-5 text-slate-500">{pillar.strength}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${statusClasses[pillar.status]}`}>
                {statusLabel(pillar.status)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {diagnosis?.primary ? (
        <div className="mt-4 w-fit rounded-full border border-fuchsia-300/15 bg-fuchsia-300/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-200">
          Current focus · {focusLabels[diagnosis.primary]}
        </div>
      ) : null}

      {canImproveIdentity ? (
        <Link
          href={identityActionHref!}
          className="mt-6 flex w-full items-center justify-between rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(200,255,56,0.10)] transition hover:bg-lime-200"
        >
          <span>Improve Identity &amp; Traceability</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}

      <Link
        href="/passport"
        className={`${canImproveIdentity ? "mt-3" : "mt-auto pt-6"} text-center text-sm font-black text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 hover:text-white`}
      >
        See my full Passport
      </Link>
    </div>
  );
}

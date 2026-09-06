import type { RecoveryEvidenceItem } from "@/lib/recovery/experience";

const CONFIDENCE_LABEL: Record<RecoveryEvidenceItem["confidence"], string> = {
  verified: "Verified",
  confirmed: "Confirmed",
  pending: "Pending",
  unknown: "Unknown",
};

const CONFIDENCE_CLASS: Record<RecoveryEvidenceItem["confidence"], string> = {
  verified: "border-lime-300/20 bg-lime-300/10 text-lime-200",
  confirmed: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  pending: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  unknown: "border-white/10 bg-white/[0.04] text-slate-400",
};

export function RecoveryEvidence({ evidence }: { evidence: RecoveryEvidenceItem[] }) {
  return (
    <div className="space-y-3" aria-label="Recovery evidence">
      {evidence.map((item) => (
        <div key={item.key} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-white">{item.label}</p>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${CONFIDENCE_CLASS[item.confidence]}`}>
              {CONFIDENCE_LABEL[item.confidence]}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">{item.statusText}</p>
        </div>
      ))}
    </div>
  );
}

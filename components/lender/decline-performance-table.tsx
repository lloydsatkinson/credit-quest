import { getCanonicalDeclineReason } from "@/lib/recovery/decline-taxonomy";
import type { LenderPilotAnalytics } from "@/lib/server/lender-analytics-repository";

function familyLabel(code: string): string {
  const family = getCanonicalDeclineReason(code)?.riskFamily ?? "unknown";
  if (family === "unknown") return "Unknown";
  return family.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export function DeclinePerformanceTable({ reasons }: { reasons: LenderPilotAnalytics["declineReasons"] }) {
  if (reasons.length === 0) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600">No aggregate decline data is available for this cohort.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-black">Canonical reason</th>
            <th className="px-4 py-3 font-black">Family</th>
            <th className="px-4 py-3 text-right font-black">Handoffs</th>
            <th className="px-4 py-3 text-right font-black">Activated</th>
            <th className="px-4 py-3 text-right font-black">Ready</th>
            <th className="px-4 py-3 text-right font-black">Returned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reasons.map((reason) => (
            <tr key={reason.canonicalCode}>
              <td className="px-4 py-3 font-bold text-slate-950">{reason.canonicalCode}</td>
              <td className="px-4 py-3 text-slate-600">{familyLabel(reason.canonicalCode)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{reason.handoffs}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{reason.activated}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{reason.ready}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{reason.returned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { MetricsResult } from "@/lib/server/metrics-repository";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function poundsFromMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amountMinor / 100);
}

export function MetricsDashboard({ result }: { result: MetricsResult }) {
  if (!result.available) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-xl font-black text-slate-950">Operational metrics</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">Metrics are temporarily unavailable. No zero values are being inferred.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black">Customer progress</h2>
          <p className="mt-1 text-sm text-slate-600">Observed outcomes from the last {result.windowDays} days.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Onboarding completed" value={result.journey.onboardingCompleted} />
          <Metric label="Missions started" value={result.journey.missionStarted} />
          <Metric label="Missions completed" value={result.journey.missionCompleted} />
          <Metric label="Reassessments" value={result.journey.reassessments} />
          <Metric label="Readiness changes" value={result.journey.readinessChanged} />
          <Metric label="Red → amber" value={result.journey.readinessMovement.red_to_amber} />
          <Metric label="Amber → green" value={result.journey.readinessMovement.amber_to_green} />
          <Metric label="Service reminders sent" value={result.journey.remindersSent} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black">Commercial readiness</h2>
          <p className="mt-1 text-sm text-slate-600">Sandbox and reporting signals only. These metrics never rank customer actions.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Sandbox referrals" value={result.commercial.sandboxReferrals} />
          <Metric label="Consent accepted" value={result.commercial.consentAccepted} />
          <Metric label="Revenue events" value={result.commercial.revenueEvents} />
          <Metric label="Confirmed revenue" value={poundsFromMinor(result.commercial.confirmedRevenueMinor)} />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">Revenue is reporting only — it does not affect customer strategy.</p>
      </div>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";

interface PartnerOption { id: string; displayName: string }
interface SimulatorResult {
  treatment: string;
  barrierResolution: { primary: { code: string } | null };
  alternativeRouteState: string;
  originalRouteState: string;
  suppressionReason: string | null;
  reassessment: { result: boolean | "unknown" } | null;
  steps: Record<"now" | "next" | "then" | "later", Array<{ id: string; customerWording: string }>>;
  policyVersions: Record<string, number[]>;
}

export function RecoverySimulatorForm({ partners }: { partners: PartnerOption[] }) {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<SimulatorResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const facts: Record<string, string | number | boolean | null> = {};
    const months = String(form.get("monthsSinceDecline") ?? "").trim();
    const disposable = String(form.get("disposableIncome") ?? "").trim();
    const verified = String(form.get("evidenceVerified") ?? "unknown");
    if (months) facts.monthsSinceDecline = Number(months);
    if (disposable) facts.disposableIncome = Number(disposable);
    if (verified !== "unknown") facts.evidenceVerified = verified === "true";

    setStatus("Running production-equivalent simulation…");
    setResult(null);
    const response = await fetch("/api/admin/recovery/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        partnerId: String(form.get("partnerId") ?? ""),
        productCategory: String(form.get("productCategory") ?? "credit_card"),
        declineCodes: String(form.get("declineCodes") ?? "").split(",").map((code) => code.trim()).filter(Boolean),
        facts,
        now: new Date().toISOString(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error ?? "Simulation failed.");
      return;
    }
    setResult(data as SimulatorResult);
    setStatus("Simulation complete. No customer readiness was changed.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={submit} className="grid content-start gap-3 rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-black text-slate-950">Simulation inputs</h2>
        <select name="partnerId" required defaultValue="" className="rounded-xl border p-3"><option value="" disabled>Select lender</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.displayName}</option>)}</select>
        <select name="productCategory" defaultValue="credit_card" className="rounded-xl border p-3"><option value="credit_card">Credit card</option><option value="loan">Loan</option><option value="overdraft">Overdraft</option><option value="mortgage">Mortgage</option><option value="other">Other</option></select>
        <input name="declineCodes" required placeholder="Lender codes, comma separated" className="rounded-xl border p-3" />
        <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Controlled facts</p>
          <input name="monthsSinceDecline" type="number" min={0} step="1" placeholder="Months since decline" className="rounded-xl border p-3" />
          <input name="disposableIncome" type="number" step="0.01" placeholder="Disposable income" className="rounded-xl border p-3" />
          <select name="evidenceVerified" defaultValue="unknown" className="rounded-xl border p-3"><option value="unknown">Evidence verified: unknown</option><option value="true">Evidence verified: yes</option><option value="false">Evidence verified: no</option></select>
        </div>
        <button disabled={!partners.length} className="rounded-xl bg-violet-700 px-4 py-3 font-black text-white disabled:opacity-40">Simulate journey</button>
        <p className="text-xs leading-5 text-slate-500">The simulator previews policy resolution only. It does not write Passport, Mission, Safe Mode or Application Readiness state.</p>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-black text-slate-950">Resolved journey preview</h2>
        {!result ? <p className="mt-3 text-sm text-slate-600">Run a scenario to inspect canonical mapping, precedence, treatment and configured journey phases.</p> : (
          <div className="mt-4 grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Primary barrier</p><p className="mt-1 font-black">{result.barrierResolution.primary?.code ?? "Unknown / unmapped"}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Treatment</p><p className="mt-1 font-black">{result.treatment}</p></div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-black">Route preview</p><p className="mt-2 text-sm text-slate-700">Original: <strong>{result.originalRouteState}</strong> · Alternative: <strong>{result.alternativeRouteState}</strong></p>{result.suppressionReason ? <p className="mt-2 text-sm text-amber-800">Suppressed: {result.suppressionReason}</p> : null}</div>
            {(["now", "next", "then", "later"] as const).map((phase) => <div key={phase}><p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">{phase}</p>{result.steps[phase].length ? <ul className="mt-2 grid gap-2">{result.steps[phase].map((step) => <li key={step.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{step.customerWording}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No configured step.</p>}</div>)}
            <p className="text-xs text-slate-500">Reassessment condition: {result.reassessment ? String(result.reassessment.result) : "not configured"}. Policy versions: {JSON.stringify(result.policyVersions)}.</p>
          </div>
        )}
        {status ? <p role="status" className="mt-4 text-sm font-bold text-slate-700">{status}</p> : null}
      </section>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { CANONICAL_DECLINE_REASONS } from "@/lib/recovery/decline-taxonomy";

interface PartnerOption {
  id: string;
  displayName: string;
}

interface PolicyRow {
  id: string;
  kind: "mapping" | "template" | "reassessment_rule" | "alternative_route";
  key: string;
  canonicalCode: string;
  version: number;
  lifecycle: "draft" | "tested" | "published" | "retired";
}

function valueAsScalar(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

export function RecoveryPolicyForm({ partners, rows }: { partners: PartnerOption[]; rows: PolicyRow[] }) {
  const [status, setStatus] = useState("");
  const [templateCanonicalCode, setTemplateCanonicalCode] = useState(CANONICAL_DECLINE_REASONS[0]?.code ?? "THIN_FILE");
  const templateCanonical = CANONICAL_DECLINE_REASONS.find((reason) => reason.code === templateCanonicalCode)
    ?? CANONICAL_DECLINE_REASONS[0];

  async function postPolicy(body: unknown) {
    setStatus("Saving draft…");
    const response = await fetch("/api/admin/recovery/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Draft saved: ${data.id}` : data.error ?? "Could not save draft.");
    if (response.ok) window.location.reload();
  }

  async function submitMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameterName = String(form.get("parameterName") ?? "").trim();
    const parameterValue = String(form.get("parameterValue") ?? "");
    await postPolicy({
      kind: "mapping",
      partnerId: String(form.get("partnerId") ?? ""),
      productCategory: String(form.get("productCategory") ?? "credit_card"),
      externalCode: String(form.get("externalCode") ?? ""),
      canonicalCode: String(form.get("canonicalCode") ?? ""),
      parameters: parameterName ? { [parameterName]: valueAsScalar(parameterValue) } : {},
      lenderWording: String(form.get("lenderWording") ?? "") || null,
      version: Number(form.get("version") ?? 1),
    });
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateCanonical) return;
    const form = new FormData(event.currentTarget);
    const phaseInputs = [
      ["now", "action", "nowStep", 10],
      ["next", "action", "nextStep", 20],
      ["then", "wait", "thenStep", 30],
      ["later", "reassessment", "laterStep", 40],
    ] as const;
    const steps = phaseInputs.flatMap(([phase, stepType, field, priority]) => {
      const customerWording = String(form.get(field) ?? "").trim();
      if (!customerWording) return [];
      return [{
        phase,
        stepType,
        priority,
        customerWording,
        missionSlug: null,
        minWaitDays: stepType === "wait" ? 30 : null,
        blocking: phase === "now",
        requirementStatus: phase === "now" ? "required" : "recommended",
      }];
    });
    await postPolicy({
      kind: "template",
      templateKey: String(form.get("templateKey") ?? ""),
      canonicalCode: templateCanonical.code,
      treatment: templateCanonical.treatment,
      solveability: templateCanonical.solveability,
      severity: String(form.get("severity") ?? "medium"),
      recoveryHorizon: String(form.get("recoveryHorizon") ?? "medium"),
      customerHeadline: String(form.get("customerHeadline") ?? ""),
      customerExplanation: String(form.get("customerExplanation") ?? ""),
      version: Number(form.get("version") ?? 1),
      steps,
    });
  }

  async function publish(draftId: string) {
    setStatus("Validating and publishing…");
    const response = await fetch("/api/admin/recovery/policies/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftId }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Policy version published." : data.error ?? "Could not publish policy.");
    if (response.ok) window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submitMapping} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Code mapping</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Map lender decline code</h2>
          </div>
          <select name="partnerId" required className="rounded-xl border p-3" defaultValue="">
            <option value="" disabled>Select lender</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.displayName}</option>)}
          </select>
          <select name="productCategory" className="rounded-xl border p-3" defaultValue="credit_card">
            <option value="credit_card">Credit card</option><option value="loan">Loan</option><option value="overdraft">Overdraft</option><option value="mortgage">Mortgage</option><option value="other">Other</option>
          </select>
          <input name="externalCode" required maxLength={120} placeholder="Lender decline code" className="rounded-xl border p-3" />
          <select name="canonicalCode" required className="rounded-xl border p-3" defaultValue="THIN_FILE">
            {CANONICAL_DECLINE_REASONS.map((reason) => <option key={reason.code} value={reason.code}>{reason.code} · {reason.treatment}</option>)}
          </select>
          <input name="lenderWording" maxLength={500} placeholder="Optional lender wording" className="rounded-xl border p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="parameterName" maxLength={80} placeholder="Parameter, e.g. cooldownMonths" className="rounded-xl border p-3" />
            <input name="parameterValue" maxLength={120} placeholder="Value" className="rounded-xl border p-3" />
          </div>
          <input name="version" type="number" min={1} defaultValue={1} className="rounded-xl border p-3" aria-label="Mapping version" />
          <button disabled={!partners.length} className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-40">Save mapping draft</button>
        </form>

        <form onSubmit={submitTemplate} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">Recovery template</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Build customer journey context</h2>
          </div>
          <input name="templateKey" required maxLength={120} placeholder="Template key" className="rounded-xl border p-3" />
          <select value={templateCanonicalCode} onChange={(event) => setTemplateCanonicalCode(event.target.value)} className="rounded-xl border p-3" aria-label="Canonical decline reason">
            {CANONICAL_DECLINE_REASONS.map((reason) => <option key={reason.code} value={reason.code}>{reason.code}</option>)}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">Governed treatment<input readOnly value={templateCanonical?.treatment ?? ""} className="mt-1 w-full rounded-xl border bg-slate-50 p-3" /></label>
            <label className="text-xs font-bold text-slate-600">Solveability<input readOnly value={templateCanonical?.solveability ?? ""} className="mt-1 w-full rounded-xl border bg-slate-50 p-3" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="severity" defaultValue="medium" className="rounded-xl border p-3"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="structural">Structural</option></select>
            <select name="recoveryHorizon" defaultValue="medium" className="rounded-xl border p-3"><option value="immediate">Immediate</option><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option><option value="structural_indeterminate">Structural / indeterminate</option></select>
          </div>
          <input name="customerHeadline" required maxLength={240} placeholder="Customer headline" className="rounded-xl border p-3" />
          <textarea name="customerExplanation" required maxLength={1500} placeholder="Customer explanation" className="rounded-xl border p-3" />
          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">NOW / NEXT / THEN / LATER</p>
            <input name="nowStep" maxLength={500} placeholder="NOW — immediate safe action" className="rounded-xl border p-3" />
            <input name="nextStep" maxLength={500} placeholder="NEXT — evidence building" className="rounded-xl border p-3" />
            <input name="thenStep" maxLength={500} placeholder="THEN — genuine wait/evidence period" className="rounded-xl border p-3" />
            <input name="laterStep" maxLength={500} placeholder="LATER — reassessment wording" className="rounded-xl border p-3" />
          </div>
          <input name="version" type="number" min={1} defaultValue={1} className="rounded-xl border p-3" aria-label="Template version" />
          <button className="rounded-xl bg-violet-700 px-4 py-3 font-black text-white">Save template draft</button>
        </form>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Version history</p><h2 className="mt-1 text-xl font-black text-slate-950">Recovery policy records</h2></div>
          <a href="/admin/recovery/simulator" className="rounded-xl border border-violet-200 px-3 py-2 text-sm font-black text-violet-700">Open simulator</a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Type</th><th className="pb-3">Key</th><th className="pb-3">Canonical reason</th><th className="pb-3">Version</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.kind}-${row.id}`} className="border-t border-slate-100"><td className="py-3 font-bold">{row.kind}</td><td className="py-3">{row.key}</td><td className="py-3 font-mono text-xs">{row.canonicalCode}</td><td className="py-3">{row.version}</td><td className="py-3">{row.lifecycle}</td><td className="py-3">{row.lifecycle === "draft" || row.lifecycle === "tested" ? <button type="button" onClick={() => publish(row.id)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">Validate + publish</button> : <span className="text-xs text-slate-500">Immutable</span>}</td></tr>)}</tbody>
          </table>
          {!rows.length ? <p className="py-4 text-sm text-slate-600">No recovery policy versions yet.</p> : null}
        </div>
      </section>
      {status ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-700">{status}</p> : null}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";

export function ExperimentForm() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const primary = String(form.get("primaryVariant") ?? "control");
    const secondary = String(form.get("secondaryVariant") ?? "alternate");
    setStatus("Saving…");
    const response = await fetch("/api/admin/experiments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        experimentKey: String(form.get("experimentKey") ?? ""),
        status: String(form.get("status") ?? "draft"),
        surfaceKey: String(form.get("surfaceKey") ?? "commercial_route_order"),
        variants: [
          { key: primary, presentationKey: primary },
          { key: secondary, presentationKey: secondary },
        ],
      }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Experiment saved." : data.error ?? "Could not save experiment.");
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Presentation experiment</h2>
      <input name="experimentKey" required pattern="[a-z0-9-]+" placeholder="experiment-key" className="rounded-xl border p-3" />
      <select name="surfaceKey" className="rounded-xl border p-3" defaultValue="commercial_route_order">
        <option value="commercial_route_order">Commercial route order</option>
        <option value="journey_status_copy">Journey status copy</option>
        <option value="journey_email_opt_in_copy">Journey email opt-in copy</option>
      </select>
      <select name="status" className="rounded-xl border p-3" defaultValue="draft">
        <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option>
      </select>
      <input name="primaryVariant" required pattern="[a-z0-9-]+" defaultValue="control" className="rounded-xl border p-3" />
      <input name="secondaryVariant" required pattern="[a-z0-9-]+" defaultValue="alternate" className="rounded-xl border p-3" />
      <p className="text-xs leading-5 text-slate-500">Experiments can change presentation only; they cannot change eligibility, safety, readiness or mission ranking.</p>
      <button className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Save experiment</button>
      {status ? <p role="status" className="text-sm font-bold text-slate-700">{status}</p> : null}
    </form>
  );
}

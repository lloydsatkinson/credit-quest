"use client";

import { useState, type FormEvent } from "react";
import {
  approvedPresentationKeys,
  experimentSurfaces,
  type ExperimentSurface,
} from "@/lib/experiments/types";

const surfaceLabels: Record<ExperimentSurface, string> = {
  commercial_route_order: "Commercial route order",
  journey_status_copy: "Journey status copy",
  journey_email_opt_in_copy: "Journey email opt-in copy",
};

export function ExperimentForm() {
  const [status, setStatus] = useState("");
  const [surface, setSurface] = useState<ExperimentSurface>("commercial_route_order");
  const presentationKeys = approvedPresentationKeys[surface];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const primary = String(form.get("primaryVariant") ?? presentationKeys[0]);
    const secondary = String(form.get("secondaryVariant") ?? presentationKeys[1]);
    setStatus("Saving…");
    const response = await fetch("/api/admin/experiments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        experimentKey: String(form.get("experimentKey") ?? ""),
        status: String(form.get("status") ?? "draft"),
        surfaceKey: surface,
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
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Experiment key
        <input name="experimentKey" required pattern="[a-z0-9-]+" placeholder="experiment-key" className="rounded-xl border p-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Experiment surface
        <select
          name="surfaceKey"
          className="rounded-xl border p-3 font-normal"
          value={surface}
          onChange={(event) => setSurface(event.target.value as ExperimentSurface)}
        >
          {experimentSurfaces.map((item) => <option key={item} value={item}>{surfaceLabels[item]}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Status
        <select name="status" className="rounded-xl border p-3 font-normal" defaultValue="draft">
          <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Primary presentation
        <select key={`${surface}-primary`} name="primaryVariant" className="rounded-xl border p-3 font-normal" defaultValue={presentationKeys[0]}>
          {presentationKeys.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Secondary presentation
        <select key={`${surface}-secondary`} name="secondaryVariant" className="rounded-xl border p-3 font-normal" defaultValue={presentationKeys[1] ?? presentationKeys[0]}>
          {presentationKeys.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
      </label>
      <p className="text-xs leading-5 text-slate-500">Experiments can change presentation only; they cannot change eligibility, safety, readiness or mission ranking.</p>
      <button className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Save experiment</button>
      {status ? <p role="status" className="text-sm font-bold text-slate-700">{status}</p> : null}
    </form>
  );
}

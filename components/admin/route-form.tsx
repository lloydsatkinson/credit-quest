"use client";

import { useState, type FormEvent } from "react";

export function RouteForm({ partners }: { partners: Array<{ id: string; label: string }> }) {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Saving…");
    const response = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routeKey: String(form.get("routeKey") ?? ""),
        partnerId: String(form.get("partnerId") ?? ""),
        environment: String(form.get("environment") ?? "sandbox"),
        destinationUrl: String(form.get("destinationUrl") ?? ""),
        enabled: form.get("enabled") === "on",
        disclosureKey: String(form.get("disclosureKey") ?? ""),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Route saved." : data.error ?? "Could not save route.");
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Route configuration</h2>
      <input name="routeKey" required pattern="[a-z0-9-]+" placeholder="route-key" className="rounded-xl border p-3" />
      <select name="partnerId" required className="rounded-xl border p-3" defaultValue="">
        <option value="" disabled>Select partner</option>
        {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.label}</option>)}
      </select>
      <select name="environment" className="rounded-xl border p-3" defaultValue="sandbox">
        <option value="sandbox">Sandbox</option>
        <option value="live">Live</option>
      </select>
      <input name="destinationUrl" required placeholder="/sandbox/referral-complete" className="rounded-xl border p-3" />
      <input name="disclosureKey" required pattern="[a-z0-9-]+" placeholder="disclosure-key" className="rounded-xl border p-3" />
      <label className="font-semibold"><input name="enabled" type="checkbox" className="mr-2" />Enabled</label>
      <p className="text-xs leading-5 text-amber-800">Live routes cannot be enabled while the server regulatory lock is off.</p>
      <button className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Save route</button>
      {status ? <p role="status" className="text-sm font-bold text-slate-700">{status}</p> : null}
    </form>
  );
}

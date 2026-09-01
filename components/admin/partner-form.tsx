"use client";

import { useState, type FormEvent } from "react";

export function PartnerForm() {
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Saving…");
    const response = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        partnerKey: String(form.get("partnerKey") ?? ""),
        displayName: String(form.get("displayName") ?? ""),
        enabled: form.get("enabled") === "on",
        sandboxEnabled: form.get("sandboxEnabled") === "on",
        liveEnabled: form.get("liveEnabled") === "on",
        notes: String(form.get("notes") ?? "") || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Partner saved." : data.error ?? "Could not save partner.");
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Partner configuration</h2>
      <input name="partnerKey" required pattern="[a-z0-9-]+" placeholder="partner-key" className="rounded-xl border p-3" />
      <input name="displayName" required maxLength={120} placeholder="Display name" className="rounded-xl border p-3" />
      <textarea name="notes" maxLength={1000} placeholder="Operational notes" className="rounded-xl border p-3" />
      <label className="font-semibold"><input name="enabled" type="checkbox" className="mr-2" />Enabled</label>
      <label className="font-semibold"><input name="sandboxEnabled" type="checkbox" className="mr-2" />Sandbox enabled</label>
      <label className="font-semibold"><input name="liveEnabled" type="checkbox" className="mr-2" />Live enabled</label>
      <button className="rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Save partner</button>
      {status ? <p role="status" className="text-sm font-bold text-slate-700">{status}</p> : null}
    </form>
  );
}

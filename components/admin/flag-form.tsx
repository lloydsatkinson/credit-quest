"use client";

import { useState } from "react";

type FlagKey = "email_reminders_enabled" | "commercial_gateway_enabled";

export function FlagForm({ flagKey, enabled }: { flagKey: FlagKey; enabled: boolean }) {
  const [status, setStatus] = useState("");

  async function setEnabled(next: boolean) {
    setStatus("Saving…");
    const response = await fetch("/api/admin/flags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flagKey, enabled: next }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? `Saved: ${next ? "enabled" : "disabled"}.` : data.error ?? "Could not update flag.");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-black">{flagKey}</p><p className="text-xs text-slate-500">Current: {enabled ? "enabled" : "disabled"}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEnabled(false)} className="rounded-xl border px-3 py-2 text-sm font-bold">Disable</button>
          <button type="button" onClick={() => setEnabled(true)} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white">Enable</button>
        </div>
      </div>
      {status ? <p role="status" className="mt-2 text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}

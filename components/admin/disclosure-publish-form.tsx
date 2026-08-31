"use client";

import { useState } from "react";

export function DisclosurePublishForm({ disclosureId }: { disclosureId: string }) {
  const [status, setStatus] = useState("");

  async function publish() {
    setStatus("Publishing…");
    const response = await fetch("/api/admin/disclosures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disclosureId }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Disclosure published." : data.error ?? "Could not publish disclosure.");
  }

  return (
    <div>
      <button type="button" onClick={publish} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">Publish reviewed version</button>
      {status ? <p role="status" className="mt-2 text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}

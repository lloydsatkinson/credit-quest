"use client";

import { useState } from "react";

export function SandboxPilotForm() {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");

  async function setEnabled(enabled: boolean) {
    setStatus("Saving…");
    const response = await fetch("/api/admin/sandbox-pilots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: userId.trim(), enabled }),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(
      response.ok
        ? `Pilot ${enabled ? "enabled" : "removed"}.`
        : data.error ?? "Could not update sandbox pilot.",
    );
  }

  const disabled = userId.trim().length === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <p className="font-black">Internal sandbox pilot</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Enter an exact Auth user UUID. Pilot membership does not enable the sandbox, bypass safety checks,
          or affect live commercial routing.
        </p>
      </div>
      <label className="mt-4 block text-xs font-bold text-slate-700" htmlFor="sandbox-pilot-user-id">
        Auth user UUID
      </label>
      <input
        id="sandbox-pilot-user-id"
        type="text"
        inputMode="text"
        autoComplete="off"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEnabled(false)}
          className="rounded-xl border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove pilot
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEnabled(true)}
          className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enable pilot
        </button>
      </div>
      {status ? <p role="status" className="mt-2 text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}

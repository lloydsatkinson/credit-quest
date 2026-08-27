"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResolvedAction } from "@/lib/domain/types";

function verificationCopy(mode: ResolvedAction["verificationMode"]): string {
  switch (mode) {
    case "self_confirm_review":
      return "When you return, we’ll ask what happened. Some changes take time to appear, so this mission may move into review rather than complete immediately.";
    case "self_confirm":
      return "When you return, we’ll ask you to confirm what you completed. Clicking Continue alone does not complete the mission.";
    case "internal_state":
      return "Credit Quest will update the mission state only after the in-app action is started successfully.";
    case "api_verified":
      return "Credit Quest will only complete this mission after the connected service confirms the change.";
    case "partner_callback":
      return "Credit Quest will wait for a supported partner confirmation before treating this mission as complete.";
  }
}

export function ActionScreen({
  missionTitle,
  rationale,
  resolvedAction,
  missionInstanceId,
  targetLabel,
}: {
  missionTitle: string;
  rationale: string;
  resolvedAction: ResolvedAction;
  missionInstanceId: string;
  targetLabel?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const external = resolvedAction.mode === "external_link";
  const providerLabel = resolvedAction.providerName ?? "the external provider";

  async function startAction() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/actions/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ missionInstanceId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "We could not start this action.");
        return;
      }
      if (data.attemptId) {
        localStorage.setItem("creditquest-pending-action-attempt", String(data.attemptId));
      }
      if (typeof data.destinationUrl === "string" && data.destinationUrl) {
        window.location.assign(data.destinationUrl);
        return;
      }
      setError("This action does not currently have a safe destination. Please return to your dashboard.");
    } catch {
      setError("We could not start this action. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="font-black text-violet-700">← Dashboard</Link>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mission action</span>
      </header>

      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <p className="text-xs font-black uppercase tracking-wider text-violet-600">Your next step</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{missionTitle}</h1>
        <p className="mt-3 leading-7 text-slate-600">{rationale}</p>

        {targetLabel && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Applies to</p>
            <p className="mt-1 font-bold text-slate-900">{targetLabel}</p>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-violet-50 p-4 text-violet-950">
          <p className="text-sm font-black">What to do</p>
          <p className="mt-2 text-sm leading-6">{resolvedAction.instructions}</p>
        </div>

        {external && (
          <div className="mt-5 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-600">
            <p>This next step is operated by {providerLabel}, not Credit Quest.</p>
            <p className="mt-2">Opening or using that service does not mean the mission is complete.</p>
          </div>
        )}

        <p className="mt-5 text-sm leading-6 text-slate-600">{verificationCopy(resolvedAction.verificationMode)}</p>
        {resolvedAction.fallbackUsed && (
          <p className="mt-3 text-xs leading-5 text-slate-500">We do not have a provider-specific route for this account yet, so we’re using the safe general route.</p>
        )}

        {error && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={startAction}
          className="mt-6 w-full rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50"
        >
          {busy ? "Starting…" : external && resolvedAction.providerName ? `Continue to ${resolvedAction.providerName}` : "Continue"}
        </button>
        <Link href="/dashboard" className="mt-3 block text-center text-sm font-bold text-slate-500">Not now</Link>
      </section>
    </main>
  );
}

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
    <main
      data-testid="mission-action-shell"
      className="mx-auto min-h-screen max-w-3xl px-5 py-6 text-white sm:px-8 sm:py-10"
    >
      <header className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-black text-cyan-300 transition hover:text-cyan-200">← Quest Feed</Link>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
          Mission action
        </span>
      </header>

      <section className="cq-panel relative mt-8 overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-64 rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-lime-300">
              One clear action
            </span>
            <span className="text-xs font-bold text-slate-500">Step 1 of 1</span>
          </div>

          <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">{missionTitle}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">{rationale}</p>

          {targetLabel && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">This applies to</p>
              <p className="mt-1 font-bold text-white">{targetLabel}</p>
            </div>
          )}
        </div>
      </section>

      <section data-testid="action-instructions-panel" className="cq-panel mt-5 rounded-[2rem] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-sm font-black text-cyan-200">01</span>
          <div>
            <p className="cq-kicker">What to do</p>
            <p className="mt-2 text-base font-semibold leading-7 text-slate-200">{resolvedAction.instructions}</p>
          </div>
        </div>

        {external && (
          <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-sm leading-6 text-slate-300">
            <p className="font-bold text-amber-100">You are about to leave Credit Quest.</p>
            <p className="mt-1">This next step is operated by {providerLabel}, not Credit Quest.</p>
            <p className="mt-1">Opening or using that service does not mean the mission is complete.</p>
          </div>
        )}

        <div className="mt-6 border-t border-white/8 pt-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.035] text-sm font-black text-slate-400">02</span>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">What happens next</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{verificationCopy(resolvedAction.verificationMode)}</p>
              {resolvedAction.fallbackUsed && (
                <p className="mt-3 text-xs leading-5 text-slate-500">We do not have a provider-specific route for this account yet, so we’re using the safe general route.</p>
              )}
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.055] p-4 text-sm font-semibold text-rose-200">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={startAction}
          className="mt-7 w-full rounded-2xl bg-cyan-300 px-5 py-4 text-base font-black text-slate-950 shadow-[0_12px_40px_rgba(31,228,255,0.14)] transition hover:bg-cyan-200 disabled:opacity-50"
        >
          {busy ? "Starting…" : external && resolvedAction.providerName ? `Continue to ${resolvedAction.providerName}` : "Continue"}
        </button>
        <Link href="/dashboard" className="mt-3 block rounded-2xl px-5 py-3 text-center text-sm font-bold text-slate-500 transition hover:bg-white/[0.035] hover:text-white">Not now</Link>
      </section>
    </main>
  );
}

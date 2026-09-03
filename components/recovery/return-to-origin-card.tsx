"use client";

import { useState } from "react";

interface ReturnResponse {
  status?: "redirect" | "declined";
  returnAttemptId?: string;
  destinationUrl?: string;
  partnerDisplayName?: string;
  error?: string;
}

export function ReturnToOriginCard({
  recoveryJourneyId,
  partnerDisplayName,
}: {
  recoveryJourneyId: string;
  partnerDisplayName: string;
}) {
  const [submitting, setSubmitting] = useState<"continue" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function choose(customerChoice: "continue" | "decline") {
    if (submitting) return;
    setSubmitting(customerChoice);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/recovery/return", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recoveryJourneyId, customerChoice }),
      });
      const data = await response.json().catch(() => null) as ReturnResponse | null;

      if (!response.ok || !data?.status) {
        setError("This return route is not available right now.");
        return;
      }

      if (data.status === "declined") {
        setMessage("No problem — you can keep using Credit Quest and decide again later if the option is still available.");
        return;
      }

      const destination = data.destinationUrl;
      if (
        data.status !== "redirect"
        || typeof destination !== "string"
        || !destination.startsWith("/sandbox/")
        || destination.startsWith("//")
      ) {
        setError("This return route is not available right now.");
        return;
      }

      window.location.assign(destination);
    } catch {
      setError("This return route is not available right now.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section className="cq-panel mb-4 rounded-[1.75rem] p-5 text-white" aria-label="Return to original partner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="cq-kicker">Optional next step</p>
        <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-lime-200">
          Ready to check
        </span>
      </div>

      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
        You’ve made the progress we were waiting for.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Based on the information we have, you’re ready to check eligibility again.
      </p>

      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
        <p className="text-sm font-bold leading-6 text-slate-200">
          You can choose to continue with {partnerDisplayName}. This does not mean {partnerDisplayName} will approve you, and the partner still makes its own eligibility, affordability and lending decision.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={Boolean(submitting)}
          onClick={() => void choose("continue")}
          className="rounded-2xl bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_10px_32px_rgba(200,255,56,0.12)] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting === "continue" ? "Checking route…" : `Continue with ${partnerDisplayName}`}
        </button>
        <button
          type="button"
          disabled={Boolean(submitting)}
          onClick={() => void choose("decline")}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting === "decline" ? "Saving choice…" : "Not now"}
        </button>
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
        The destination is controlled by Credit Quest’s server-side sandbox contract. This screen cannot choose or override it.
      </p>

      {message ? (
        <p role="status" className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3 text-sm font-bold text-cyan-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-300/[0.055] p-3 text-sm font-bold text-rose-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}

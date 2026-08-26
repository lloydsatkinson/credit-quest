"use client";

import { useState } from "react";
import type { ActionAttempt } from "@/lib/domain/types";

interface ResumeActionCardProps {
  attempt: ActionAttempt;
  missionSlug: string;
  missionTitle: string;
  providerLabel?: string | null;
}

function primaryAction(missionSlug: string): { label: string; response: string } {
  switch (missionSlug) {
    case "register-electoral-roll":
      return { label: "I submitted my registration", response: "submitted" };
    case "set-up-direct-debit":
      return { label: "I set up the direct debit", response: "completed" };
    case "reduce-utilisation":
      return { label: "I've updated the balance", response: "completed" };
    case "application-cooldown":
      return { label: "Start my cooldown", response: "started" };
    case "build-revolving-history":
      return { label: "I completed the provider step", response: "completed" };
    default:
      return { label: "I completed this step", response: "completed" };
  }
}

export function ResumeActionCard({
  attempt,
  missionSlug,
  missionTitle,
  providerLabel,
}: ResumeActionCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const primary = primaryAction(missionSlug);

  async function respond(response: string) {
    setBusy(response);
    setError(null);
    try {
      const result = await fetch(`/api/actions/attempts/${attempt.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.error ?? "Could not save your update");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your update");
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Welcome back</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{missionTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {providerLabel
          ? `You left Credit Quest to continue with ${providerLabel}. Tell us what happened so we can keep this mission accurate.`
          : "Tell us what happened so we can keep this mission accurate."}
      </p>

      {missionSlug === "reduce-utilisation" ? (
        <p className="mt-3 rounded-2xl bg-white p-3 text-xs leading-5 text-slate-600">
          Update the card balance in My accounts first if it has changed. Credit Quest will only complete this mission when the stored balance and limit show utilisation at or below the target.
        </p>
      ) : null}

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond(primary.response)}
          className="rounded-2xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {busy === primary.response ? "Saving…" : primary.label}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond("not_finished")}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          I started but did not finish
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond("could_not_do")}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          I could not do it
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond("do_later")}
          className="px-4 py-2 text-sm font-bold text-slate-500 disabled:opacity-50"
        >
          Do this later
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import type { ActionAttempt } from "@/lib/domain/types";

interface ResumeActionCardProps {
  attempt: ActionAttempt;
  missionSlug: string;
  missionTitle: string;
  providerLabel?: string | null;
}

function primaryAction(missionSlug: string, attempt: ActionAttempt): { label: string; response: string } {
  if (attempt.status === "submitted") {
    if (missionSlug === "register-electoral-roll") {
      return { label: "I'm now registered", response: "confirmed_registered" };
    }
    if (missionSlug === "build-revolving-history") {
      return { label: "I opened the account", response: "confirmed_account_opened" };
    }
  }

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
  const primary = primaryAction(missionSlug, attempt);

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
    <section data-testid="resume-action-card" className="cq-panel rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="cq-kicker">Welcome back</p>
        <span className="rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
          Follow-up
        </span>
      </div>
      <h2 className="mt-3 text-xl font-black tracking-tight text-white">{missionTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {providerLabel
          ? `You left Credit Quest to continue with ${providerLabel}. Tell us what happened so we can keep this mission accurate.`
          : "Tell us what happened so we can keep this mission accurate."}
      </p>

      {missionSlug === "reduce-utilisation" ? (
        <p className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.045] p-3 text-xs leading-5 text-slate-300">
          Update the card balance in My accounts first if it has changed. Credit Quest will only complete this mission when the stored balance and limit show utilisation at or below the target.
        </p>
      ) : null}

      {attempt.status === "submitted" ? (
        <p className="mt-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.045] p-3 text-xs leading-5 text-slate-300">
          This is a follow-up check. Confirm the real-world outcome only if it has actually happened; the earlier provider or application step did not complete the mission by itself.
        </p>
      ) : null}

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond(primary.response)}
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(31,228,255,0.09)] disabled:opacity-50"
        >
          {busy === primary.response ? "Saving…" : primary.label}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond("not_finished")}
          className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-200 disabled:opacity-50"
        >
          I started but did not finish
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => respond("could_not_do")}
          className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-200 disabled:opacity-50"
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

      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-300">{error}</p> : null}
    </section>
  );
}

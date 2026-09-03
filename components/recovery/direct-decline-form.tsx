"use client";

import { FormEvent, useState } from "react";

const productOptions = [
  ["credit_card", "Credit card"],
  ["loan", "Personal loan"],
  ["overdraft", "Overdraft"],
  ["mortgage", "Mortgage"],
  ["other", "Other credit"],
] as const;

export function DirectDeclineForm() {
  const [productCategory, setProductCategory] = useState("credit_card");
  const [declinedDate, setDeclinedDate] = useState("");
  const [providerName, setProviderName] = useState("");
  const [reasonProvided, setReasonProvided] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [recentApplications, setRecentApplications] = useState("unknown");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!declinedDate) {
      setStatus("error");
      setMessage("Tell us roughly when the decline happened.");
      return;
    }

    setStatus("saving");
    const response = await fetch("/api/recovery/declines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productCategory,
        declinedAt: new Date(`${declinedDate}T12:00:00.000Z`).toISOString(),
        providerName: providerName.trim() || null,
        declineReasonProvided: reasonProvided,
        declineReasonCode: reasonProvided && reasonCode.trim() ? reasonCode.trim() : null,
        recentApplicationContext: recentApplications,
      }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "We could not start your recovery plan.");
      return;
    }

    setStatus("done");
    setMessage(
      body.persisted === false
        ? "Demo recovery plan started. Nothing was saved."
        : "Recovery started. We’ll use your Credit Quest evidence to work out what to focus on next.",
    );
  }

  return (
    <form onSubmit={submit} className="cq-panel rounded-[2rem] p-5 sm:p-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-300">
          What type of credit was it?
          <select
            className="cq-field mt-2"
            value={productCategory}
            onChange={(event) => setProductCategory(event.target.value)}
          >
            {productOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-slate-300">
          When were you declined?
          <input
            className="cq-field mt-2"
            type="date"
            value={declinedDate}
            onChange={(event) => setDeclinedDate(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="mt-5 block text-sm font-bold text-slate-300">
        Who was it with? <span className="font-normal text-slate-500">Optional</span>
        <input
          className="cq-field mt-2"
          value={providerName}
          maxLength={120}
          placeholder="e.g. your bank or card provider"
          onChange={(event) => setProviderName(event.target.value)}
        />
      </label>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-300">
          Did they give you a reason?
          <select
            className="cq-field mt-2"
            value={reasonProvided ? "yes" : "no"}
            onChange={(event) => {
              const provided = event.target.value === "yes";
              setReasonProvided(provided);
              if (!provided) setReasonCode("");
            }}
          >
            <option value="no">No / I’m not sure</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        <label className="text-sm font-bold text-slate-300">
          Recent applications
          <select
            className="cq-field mt-2"
            value={recentApplications}
            onChange={(event) => setRecentApplications(event.target.value)}
          >
            <option value="none">None recently</option>
            <option value="one">One recently</option>
            <option value="multiple">More than one recently</option>
            <option value="unknown">I’m not sure</option>
          </select>
        </label>
      </div>

      {reasonProvided ? (
        <label className="mt-5 block text-sm font-bold text-slate-300">
          What reason were you actually given?
          <input
            className="cq-field mt-2"
            value={reasonCode}
            maxLength={160}
            placeholder="Use the wording they gave you"
            onChange={(event) => setReasonCode(event.target.value)}
            required
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
            We’ll record this as information you supplied, not as Credit Quest’s diagnosis.
          </span>
        </label>
      ) : null}

      <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm leading-6 text-slate-400">
        A decline does not automatically tell us why it happened. Credit Quest will use the evidence already in your profile to identify the safest next steps.
      </div>

      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-lime-300 px-5 py-3 text-sm font-black text-[#091015] shadow-[0_0_24px_rgba(200,255,56,0.14)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "Starting recovery…" : "Build my recovery plan"}
      </button>

      {message ? (
        <p
          aria-live="polite"
          className={`mt-4 text-sm ${status === "error" ? "text-rose-300" : "text-lime-200"}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

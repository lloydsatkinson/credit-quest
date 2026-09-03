"use client";

import { useState } from "react";
import Link from "next/link";

export interface PartnerContextReviewContext {
  partnerDisplayName: string;
  productCategory: "credit_card" | "loan" | "overdraft" | "mortgage" | "other";
  declinedAt: string;
  reason: {
    known: boolean;
    code: string | null;
    source: "partner" | "unknown";
  };
}

function productLabel(value: PartnerContextReviewContext["productCategory"]) {
  return {
    credit_card: "Credit card",
    loan: "Loan",
    overdraft: "Overdraft",
    mortgage: "Mortgage",
    other: "Credit product",
  }[value];
}

export function PartnerContextReview({
  token,
  context,
}: {
  token: string;
  context: PartnerContextReviewContext;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "signin" | "error">("idle");

  async function submit(
    contextAction: "confirm" | "correct_reason" | "reason_unknown" | "decline_optional_reason_use",
    correctedReasonCode: string | null,
  ) {
    setStatus("saving");
    try {
      const response = await fetch("/api/recovery/handoff/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, contextAction, correctedReasonCode }),
      });
      if (response.status === 401) {
        setStatus("signin");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  if (status === "saved") {
    return (
      <section className="cq-panel rounded-[2rem] p-6 sm:p-8" role="status">
        <p className="cq-kicker">Recovery context saved</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">You’re in control of what comes next.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Credit Quest has saved only the context you reviewed. Your recovery plan will still be based on Credit Quest’s own evidence and safety rules.
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950" href="/dashboard">
          Continue to Credit Quest
        </Link>
      </section>
    );
  }

  return (
    <section className="cq-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="absolute -right-20 -top-24 size-60 rounded-full bg-cyan-300/[0.045] blur-3xl" aria-hidden="true" />
      <div className="relative">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
          Partner handoff · sandbox
        </span>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">Check what we received</h1>
        <p className="mt-3 text-lg font-semibold text-slate-200">
          {context.partnerDisplayName} could not offer you this product today.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Credit Quest can use the facts below to help organise your recovery journey. They are context from the partner, not a Credit Quest diagnosis and not a promise about a future application.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Product</p>
            <p className="mt-2 font-bold text-white">{productLabel(context.productCategory)}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Decline date</p>
            <p className="mt-2 font-bold text-white">{new Date(context.declinedAt).toLocaleDateString("en-GB")}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[0.045] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200">Reason context</p>
          {context.reason.known && context.reason.code ? (
            <>
              <p className="mt-2 break-words font-bold text-white">{context.reason.code}</p>
              <p className="mt-1 text-xs text-slate-500">Supplied by {context.partnerDisplayName}. You can correct it or choose not to use it.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-300">The partner did not supply a reason we can use.</p>
          )}
        </div>

        {correcting ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="block text-sm font-black text-white" htmlFor="corrected-partner-reason">
              What did they actually tell you?
            </label>
            <input
              id="corrected-partner-reason"
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
              maxLength={160}
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!correction.trim() || status === "saving"}
                onClick={() => void submit("correct_reason", correction.trim())}
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40"
              >
                Use this correction
              </button>
              <button
                type="button"
                onClick={() => setCorrecting(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={status === "saving"}
            onClick={() => void submit("confirm", null)}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            Yes, that’s right
          </button>
          <button
            type="button"
            disabled={status === "saving"}
            onClick={() => setCorrecting(true)}
            className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
          >
            Correct the reason
          </button>
          <button
            type="button"
            disabled={status === "saving"}
            onClick={() => void submit("reason_unknown", null)}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-slate-300 disabled:opacity-50"
          >
            I’m not sure
          </button>
          <button
            type="button"
            disabled={status === "saving"}
            onClick={() => void submit("decline_optional_reason_use", null)}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-slate-300 disabled:opacity-50"
          >
            Don’t use the reason
          </button>
        </div>

        {status === "signin" ? (
          <p className="mt-5 text-sm text-amber-200" role="status">
            Sign in before binding this handoff to your account. {" "}
            <Link className="font-black underline" href={`/login?next=${encodeURIComponent(`/recovery/handoff/${token}`)}`}>
              Sign in securely
            </Link>
          </p>
        ) : null}
        {status === "error" ? (
          <p className="mt-5 text-sm text-rose-200" role="alert">
            This handoff could not be saved. The link may have expired or already been used.
          </p>
        ) : null}
      </div>
    </section>
  );
}

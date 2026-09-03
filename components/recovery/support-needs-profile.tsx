"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SupportNeedCode } from "@/lib/recovery/types";

const supportOptions: ReadonlyArray<{
  code: SupportNeedCode;
  label: string;
  detail: string;
}> = [
  {
    code: "simpler_explanations",
    label: "Use simpler explanations",
    detail: "Use plainer language and make the main point easier to spot.",
  },
  {
    code: "larger_text",
    label: "Make text larger",
    detail: "Use a larger reading size where support preferences are applied.",
  },
  {
    code: "fewer_steps",
    label: "Show fewer steps at once",
    detail: "Break longer tasks into smaller, calmer chunks.",
  },
  {
    code: "more_time",
    label: "Give me more time",
    detail: "Avoid unnecessary urgency and add confirmation before consequential steps.",
  },
  {
    code: "reduced_motion",
    label: "Reduce motion and animation",
    detail: "Prefer calmer transitions and less movement.",
  },
  {
    code: "reminder_support",
    label: "Help me remember",
    detail: "Make useful reminder options easier to find when they are available.",
  },
  {
    code: "human_support",
    label: "I’d prefer human support",
    detail: "Surface a human-help route before consequential actions when one is available.",
  },
  {
    code: "digital_support",
    label: "Help me with digital steps",
    detail: "Give extra guidance for links, forms and online tasks.",
  },
];

export function SupportNeedsProfile({
  initialNeeds,
  demo,
}: {
  initialNeeds: SupportNeedCode[];
  demo: boolean;
}) {
  const [selected, setSelected] = useState<Set<SupportNeedCode>>(
    () => new Set(initialNeeds),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const orderedNeeds = useMemo(
    () => supportOptions.filter(({ code }) => selected.has(code)).map(({ code }) => code),
    [selected],
  );

  function toggle(code: SupportNeedCode) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setStatus("idle");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/support-needs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ needs: orderedNeeds }),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "We could not save your support preferences.");
      return;
    }

    setStatus("saved");
    setMessage(
      body.persisted === false || demo
        ? "Demo preference updated. Nothing was saved."
        : "Support preferences saved.",
    );
  }

  return (
    <section className="cq-panel rounded-[2rem] p-6 sm:p-8" aria-labelledby="support-needs-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="cq-kicker">Support preferences</p>
          <h2
            id="support-needs-heading"
            className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl"
          >
            Would anything make Credit Quest easier for you to use right now?
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Choose only what would help. You do not need to tell us why, and we do not ask for a diagnosis or medical details.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
          Optional · change anytime
        </span>
      </div>

      <form onSubmit={save} className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {supportOptions.map((option) => {
            const checked = selected.has(option.code);
            return (
              <label
                key={option.code}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                  checked
                    ? "border-lime-300/30 bg-lime-300/[0.07]"
                    : "border-white/8 bg-white/[0.025] hover:border-white/15"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-lime-300"
                  checked={checked}
                  onChange={() => toggle(option.code)}
                />
                <span>
                  <span className="block text-sm font-black text-slate-100">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[0.035] p-4 text-sm leading-6 text-slate-400">
          Choosing support does not change your credit readiness or automatically turn on Safe Mode. These choices only help Credit Quest present guidance and support in a way that works better for you.
        </div>

        <button
          type="submit"
          disabled={status === "saving"}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-lime-300 px-5 py-3 text-sm font-black text-[#091015] shadow-[0_0_24px_rgba(200,255,56,0.14)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {status === "saving" ? "Saving…" : "Save support preferences"}
        </button>

        {message ? (
          <p
            aria-live="polite"
            className={`mt-3 text-sm ${status === "error" ? "text-rose-300" : "text-lime-200"}`}
          >
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/events";

const DEMO_EMAIL_PREFERENCE_KEY = "creditquest-journey-email-demo";

export function EmailReminderPreference({
  initialEnabled,
  demo,
}: {
  initialEnabled: boolean;
  demo: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!demo) return;
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem(DEMO_EMAIL_PREFERENCE_KEY);
      if (saved === "true" || saved === "false") {
        setEnabled(saved === "true");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demo]);

  async function changePreference(next: boolean) {
    setSaving(true);
    setStatus("");

    if (demo) {
      localStorage.setItem(DEMO_EMAIL_PREFERENCE_KEY, String(next));
      setEnabled(next);
      setSaving(false);
      setStatus("Saved on this device for demo mode only.");
      void trackEvent("journey_email_preference_changed", { enabled: next, mode: "demo" });
      return;
    }

    try {
      const response = await fetch("/api/communication-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ journeyEmailEnabled: next }),
      });
      const data = await response.json().catch(() => null) as {
        journeyEmailEnabled?: boolean;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "save_failed");
      const savedEnabled = data?.journeyEmailEnabled === true;
      setEnabled(savedEnabled);
      setStatus("Email reminder preference saved.");
      void trackEvent("journey_email_preference_changed", { enabled: savedEnabled, mode: "configured" });
    } catch {
      setStatus("We could not save your email reminder preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-testid="email-reminder-preference"
      className="cq-panel mb-4 rounded-[1.75rem] p-5"
      aria-label="Journey email reminders"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-300" aria-hidden="true">✦</span>
        <label className="flex flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-cyan-300"
            checked={enabled}
            disabled={saving}
            onChange={(event) => void changePreference(event.target.checked)}
          />
          <span>
            <span className="block font-black text-white">
              Email me when it’s time to review my Credit Quest plan.
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-400">
              Service reminders only. This does not sign you up for marketing.
            </span>
          </span>
        </label>
      </div>
      {status ? (
        <p role="status" className="mt-4 rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-sm font-semibold text-slate-300">
          {status}
        </p>
      ) : null}
    </section>
  );
}

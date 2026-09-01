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
      className="mb-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Journey email reminders"
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-violet-700"
          checked={enabled}
          disabled={saving}
          onChange={(event) => void changePreference(event.target.checked)}
        />
        <span>
          <span className="block font-bold text-slate-950">
            Email me when it’s time to review my Credit Quest plan.
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            Service reminders only. This does not sign you up for marketing.
          </span>
        </span>
      </label>
      {status ? (
        <p role="status" className="mt-3 text-sm font-semibold text-slate-600">
          {status}
        </p>
      ) : null}
    </section>
  );
}

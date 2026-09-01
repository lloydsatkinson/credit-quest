"use client";

import { useEffect, useMemo } from "react";
import { trackEvent } from "@/lib/events";
import { renderApprovedReminderTemplate } from "@/lib/reminders/templates";
import type { ReminderTemplateKey } from "@/lib/reminders/types";

interface InAppReminderView {
  id: string;
  reason: string;
  dueAt: string;
  templateKey: string;
}

export function InAppReminders({ reminders }: { reminders: InAppReminderView[] }) {
  const visible = useMemo(() => reminders.slice(0, 3), [reminders]);

  useEffect(() => {
    for (const reminder of visible) {
      void trackEvent("journey_reminder_shown", {
        reason: reminder.reason,
        templateKey: reminder.templateKey,
      });
    }
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <section className="mb-4 space-y-2" aria-label="Credit Quest reminders">
      {visible.map((reminder) => {
        const copy = renderApprovedReminderTemplate({
          templateKey: reminder.templateKey as ReminderTemplateKey,
          dueAt: reminder.dueAt,
          safeMode: true,
          ageMode: "education",
        });
        return (
          <article
            key={reminder.id}
            data-testid="in-app-reminder"
            className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-slate-800"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Plan reminder</p>
            <p className="mt-2 text-sm font-semibold leading-6">{copy.text}</p>
          </article>
        );
      })}
    </section>
  );
}

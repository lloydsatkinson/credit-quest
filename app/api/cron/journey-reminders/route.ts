import { NextResponse } from "next/server";
import { getAgeMode } from "@/lib/domain/age-gate";
import { assessSafety } from "@/lib/domain/safety";
import { StaticReminderCopyWriter } from "@/lib/reminders/copy-writer";
import type { ReminderTemplateKey } from "@/lib/reminders/types";
import { getCreditGuidanceForUser } from "@/lib/server/credit-guidance-service";
import { ResendEmailTransport } from "@/lib/server/email-transport";
import { isFeatureEnabled } from "@/lib/server/feature-flag-repository";
import {
  claimDueEmailReminders,
  getCommunicationPreference,
  markReminderSent,
  markReminderSuppressed,
  releaseReminderAfterFailure,
} from "@/lib/server/reminder-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function reminderCopyContext(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  now: Date,
) {
  try {
    const guidance = await getCreditGuidanceForUser(admin, userId, now);
    if (!guidance) {
      return { safeMode: true, ageMode: "education" as const };
    }
    return {
      safeMode: assessSafety(guidance.profile).mode === "safe_mode",
      ageMode: getAgeMode(guidance.profile.dateOfBirth, now),
    };
  } catch {
    return { safeMode: true, ageMode: "education" as const };
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  if (!(await isFeatureEnabled(admin, "email_reminders_enabled"))) {
    return new NextResponse(null, { status: 204 });
  }

  const now = new Date();
  const claimed = await claimDueEmailReminders(admin, now, 50);
  const transport = new ResendEmailTransport({
    apiKey: process.env.RESEND_API_KEY ?? null,
    fromEmail: process.env.JOURNEY_FROM_EMAIL ?? null,
  });
  const writer = new StaticReminderCopyWriter();

  for (const reminder of claimed) {
    try {
      if (!(await isFeatureEnabled(admin, "email_reminders_enabled"))) {
        await markReminderSuppressed(admin, reminder.id, "runtime_flag_disabled", now);
        continue;
      }

      const preference = await getCommunicationPreference(admin, reminder.userId).catch(() => null);
      if (!preference?.journeyEmailEnabled) {
        await markReminderSuppressed(admin, reminder.id, "user_disabled_or_missing", now);
        continue;
      }

      const { data, error } = await admin.auth.admin.getUserById(reminder.userId);
      const email = error ? null : data.user?.email ?? null;
      if (!email) {
        await markReminderSuppressed(admin, reminder.id, "missing_email", now);
        continue;
      }

      const context = await reminderCopyContext(admin, reminder.userId, now);
      const copy = await writer.write({
        templateKey: reminder.templateKey as ReminderTemplateKey,
        dueAt: reminder.dueAt,
        safeMode: context.safeMode,
        ageMode: context.ageMode,
      });
      const sent = await transport.send({
        to: email,
        subject: copy.subject,
        html: copy.html,
      });

      if (sent.ok) {
        await markReminderSent(admin, reminder.id, sent.providerReference, now);
      } else {
        await releaseReminderAfterFailure(
          admin,
          reminder.id,
          reminder.attemptCount,
          sent.reason,
          now,
        );
      }
    } catch {
      await releaseReminderAfterFailure(
        admin,
        reminder.id,
        reminder.attemptCount,
        "processing_error",
        now,
      ).catch(() => undefined);
    }
  }

  return NextResponse.json({ processed: claimed.length });
}

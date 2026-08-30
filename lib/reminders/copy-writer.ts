import type { ApprovedReminderCopyInput } from "@/lib/reminders/types";
import { renderApprovedReminderTemplate } from "@/lib/reminders/templates";

export interface ReminderCopyWriter {
  write(input: ApprovedReminderCopyInput): Promise<{ subject: string; text: string; html: string }>;
}

export class StaticReminderCopyWriter implements ReminderCopyWriter {
  async write(input: ApprovedReminderCopyInput) {
    return renderApprovedReminderTemplate(input);
  }
}

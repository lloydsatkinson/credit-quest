import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: {
    auth: { admin: { getUserById: vi.fn() } },
  },
  isFeatureEnabled: vi.fn(),
  claimDueEmailReminders: vi.fn(),
  getCommunicationPreference: vi.fn(),
  markReminderSent: vi.fn(),
  markReminderSuppressed: vi.fn(),
  releaseReminderAfterFailure: vi.fn(),
  getCreditGuidanceForUser: vi.fn(),
  send: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => mocks.admin,
}));

vi.mock("@/lib/server/feature-flag-repository", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

vi.mock("@/lib/server/reminder-repository", () => ({
  claimDueEmailReminders: mocks.claimDueEmailReminders,
  getCommunicationPreference: mocks.getCommunicationPreference,
  markReminderSent: mocks.markReminderSent,
  markReminderSuppressed: mocks.markReminderSuppressed,
  releaseReminderAfterFailure: mocks.releaseReminderAfterFailure,
}));

vi.mock("@/lib/server/credit-guidance-service", () => ({
  getCreditGuidanceForUser: mocks.getCreditGuidanceForUser,
}));

vi.mock("@/lib/server/email-transport", () => ({
  ResendEmailTransport: class {
    send = mocks.send;
  },
}));

vi.mock("@/lib/reminders/copy-writer", () => ({
  StaticReminderCopyWriter: class {
    write = mocks.write;
  },
}));

import { GET } from "@/app/api/cron/journey-reminders/route";

const reminder = {
  id: "r1",
  userId: "u1",
  reason: "mission_incomplete",
  channel: "email",
  status: "processing",
  dueAt: "2026-08-30T08:00:00.000Z",
  sourceOutcomeId: "o1",
  sourceKey: "mission:m1:started",
  templateKey: "mission-incomplete-v1",
  templateVersion: 1,
  suppressionReason: null,
  sentAt: null,
  providerReference: null,
  attemptCount: 1,
  claimedAt: "2026-08-30T08:00:00.000Z",
};

const adultProfile = {
  userId: "u1",
  dateOfBirth: "1990-01-01",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: true,
  utilisationPct: 20,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: true,
  hasDirectDebitForCredit: true,
};

function request(secret = "cron-secret") {
  return new Request("https://credit-quest-app.vercel.app/api/cron/journey-reminders", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("journey reminder cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.JOURNEY_FROM_EMAIL = "Credit Quest <hello@example.com>";
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.claimDueEmailReminders.mockResolvedValue([reminder]);
    mocks.getCommunicationPreference.mockResolvedValue({ journeyEmailEnabled: true });
    mocks.admin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
      error: null,
    });
    mocks.getCreditGuidanceForUser.mockResolvedValue({ profile: adultProfile });
    mocks.write.mockResolvedValue({
      subject: "Credit Quest review",
      text: "Review your Credit Quest plan.",
      html: "<p>Review your Credit Quest plan.</p>",
    });
    mocks.send.mockResolvedValue({ ok: true, providerReference: "email_123" });
    mocks.markReminderSent.mockResolvedValue(undefined);
    mocks.markReminderSuppressed.mockResolvedValue(undefined);
    mocks.releaseReminderAfterFailure.mockResolvedValue(undefined);
  });

  it("fails closed when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mocks.claimDueEmailReminders).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer secret", async () => {
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.claimDueEmailReminders).not.toHaveBeenCalled();
  });

  it("does not claim work while the email runtime flag is disabled", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    const response = await GET(request());
    expect(response.status).toBe(204);
    expect(mocks.claimDueEmailReminders).not.toHaveBeenCalled();
  });

  it("suppresses a claimed reminder if the runtime flag turns off", async () => {
    mocks.isFeatureEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.markReminderSuppressed).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      "runtime_flag_disabled",
      expect.any(Date),
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("suppresses when the user is not currently opted in", async () => {
    mocks.getCommunicationPreference.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.markReminderSuppressed).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      "user_disabled_or_missing",
      expect.any(Date),
    );
  });

  it("suppresses when the authenticated account has no email", async () => {
    mocks.admin.auth.admin.getUserById.mockResolvedValue({ data: { user: {} }, error: null });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.markReminderSuppressed).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      "missing_email",
      expect.any(Date),
    );
  });

  it("marks a successful provider delivery as sent", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 1 });
    expect(mocks.markReminderSent).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      "email_123",
      expect.any(Date),
    );
  });

  it("releases provider failures through the bounded retry path", async () => {
    mocks.send.mockResolvedValue({ ok: false, reason: "provider_unavailable" });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.releaseReminderAfterFailure).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      1,
      "provider_unavailable",
      expect.any(Date),
    );
  });

  it("uses protective copy context for an under-18 user in Safe Mode", async () => {
    mocks.getCreditGuidanceForUser.mockResolvedValue({
      profile: {
        ...adultProfile,
        dateOfBirth: "2012-01-01",
        missedPaymentsLast12m: 2,
        hardApplicationsLast6m: 3,
      },
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({
      safeMode: true,
      ageMode: "education",
    }));
  });

  it("fails copy context closed when guidance cannot be loaded", async () => {
    mocks.getCreditGuidanceForUser.mockRejectedValue(new Error("guidance unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({
      safeMode: true,
      ageMode: "education",
    }));
  });

  it("continues processing later rows after one row fails", async () => {
    const reminder2 = { ...reminder, id: "r2", userId: "u2", sourceKey: "mission:m2:started" };
    mocks.claimDueEmailReminders.mockResolvedValue([reminder, reminder2]);
    mocks.getCommunicationPreference
      .mockRejectedValueOnce(new Error("preference read failed"))
      .mockResolvedValueOnce({ journeyEmailEnabled: true });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.markReminderSuppressed).toHaveBeenCalledWith(
      expect.anything(),
      "r1",
      "user_disabled_or_missing",
      expect.any(Date),
    );
    expect(mocks.markReminderSent).toHaveBeenCalledWith(
      expect.anything(),
      "r2",
      "email_123",
      expect.any(Date),
    );
  });
});

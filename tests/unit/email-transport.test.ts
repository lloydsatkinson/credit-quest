import { describe, expect, it, vi } from "vitest";
import { ResendEmailTransport } from "@/lib/server/email-transport";

describe("ResendEmailTransport", () => {
  it("does not call the network when configuration is absent", async () => {
    const fetcher = vi.fn();
    const transport = new ResendEmailTransport({ apiKey: null, fromEmail: null, fetcher });

    await expect(transport.send({
      to: "user@example.com",
      subject: "Review",
      html: "<p>Review</p>",
    })).resolves.toEqual({ ok: false, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts only to the Resend email endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email_123" }),
    });
    const transport = new ResendEmailTransport({
      apiKey: "secret",
      fromEmail: "Credit Quest <hello@example.com>",
      fetcher,
    });

    await expect(transport.send({
      to: "user@example.com",
      subject: "Review",
      html: "<p>Review</p>",
    })).resolves.toEqual({ ok: true, providerReference: "email_123" });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns a controlled failure for provider errors", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const transport = new ResendEmailTransport({
      apiKey: "secret",
      fromEmail: "Credit Quest <hello@example.com>",
      fetcher,
    });

    await expect(transport.send({
      to: "user@example.com",
      subject: "Review",
      html: "<p>Review</p>",
    })).resolves.toEqual({ ok: false, reason: "provider_unavailable" });
  });
});

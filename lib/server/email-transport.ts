import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<
    | { ok: true; providerReference: string }
    | { ok: false; reason: "not_configured" | "provider_unavailable" }
  >;
}

export class ResendEmailTransport implements EmailTransport {
  constructor(private readonly config: {
    apiKey: string | null;
    fromEmail: string | null;
    fetcher?: typeof fetch;
  }) {}

  async send(message: EmailMessage) {
    if (!this.config.apiKey || !this.config.fromEmail) {
      return { ok: false as const, reason: "not_configured" as const };
    }

    const fetcher = this.config.fetcher ?? fetch;
    try {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.fromEmail,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });
      if (!response.ok) {
        return { ok: false as const, reason: "provider_unavailable" as const };
      }
      const body = await response.json() as { id?: string };
      return body.id
        ? { ok: true as const, providerReference: body.id }
        : { ok: false as const, reason: "provider_unavailable" as const };
    } catch {
      return { ok: false as const, reason: "provider_unavailable" as const };
    }
  }
}

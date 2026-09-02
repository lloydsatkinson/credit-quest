"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/events";

export interface CommercialGatewayCardRoute {
  id: string;
  routeKey: string;
  partnerDisplayName: string;
  disclosure: {
    id: string;
    body: string;
  };
}

export function CommercialGatewayCard({ route }: { route: CommercialGatewayCardRoute }) {
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void trackEvent("commercial_routes_shown", {
      routeId: route.id,
      routeKey: route.routeKey,
      environment: "sandbox",
    });
  }, [route.id, route.routeKey]);

  function changeConsent(next: boolean) {
    setConsent(next);
    void trackEvent(next ? "referral_consent_accepted" : "referral_consent_declined", {
      routeId: route.id,
      routeKey: route.routeKey,
      environment: "sandbox",
    });
  }

  async function continueSandboxJourney() {
    if (!consent || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/commercial/referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeId: route.id,
          disclosureId: route.disclosure.id,
          consent: true,
        }),
      });
      const data = await response.json().catch(() => null) as {
        destinationUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.destinationUrl?.startsWith("/sandbox/")) {
        setError("This route is not available right now.");
        return;
      }

      void trackEvent("sandbox_referral_created", {
        routeId: route.id,
        routeKey: route.routeKey,
        environment: "sandbox",
      });
      window.location.assign(data.destinationUrl);
    } catch {
      setError("This route is not available right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className="cq-panel rounded-[1.75rem] p-5 text-white"
      data-route-key={route.routeKey}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="cq-kicker">Optional Credit Quest route</p>
        <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/[0.055] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-fuchsia-200">Sandbox</span>
      </div>
      <h2 className="mt-3 text-xl font-black text-white">{route.partnerDisplayName}</h2>
      <p className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
        {route.disclosure.body}
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-slate-300">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-cyan-300"
          checked={consent}
          disabled={submitting}
          onChange={(event) => changeConsent(event.target.checked)}
        />
        <span>I understand this is a sandbox referral and no lender or credit application will be contacted.</span>
      </label>
      <button
        type="button"
        disabled={!consent || submitting}
        onClick={() => void continueSandboxJourney()}
        className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-black text-slate-950 shadow-[0_10px_32px_rgba(31,228,255,0.12)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Creating sandbox journey…" : "Continue sandbox journey"}
      </button>
      {error ? <p role="status" className="mt-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.055] p-3 text-sm font-bold text-rose-200">{error}</p> : null}
    </article>
  );
}

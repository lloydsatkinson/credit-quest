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
      className="rounded-[1.75rem] border border-violet-200 bg-white p-5 shadow-sm"
      data-route-key={route.routeKey}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Optional Credit Quest route</p>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-violet-700">Sandbox</span>
      </div>
      <h2 className="mt-3 text-xl font-black text-slate-950">{route.partnerDisplayName}</h2>
      <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {route.disclosure.body}
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-violet-700"
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
        className="mt-5 w-full rounded-2xl bg-violet-700 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Creating sandbox journey…" : "Continue sandbox journey"}
      </button>
      {error ? <p role="status" className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
    </article>
  );
}

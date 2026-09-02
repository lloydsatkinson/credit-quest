"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PassportDetail } from "@/components/passport/passport-detail";
import { ReadinessDetail } from "@/components/readiness/readiness-detail";
import { getAgeMode } from "@/lib/domain/age-gate";
import { diagnoseBarrier } from "@/lib/domain/diagnosis";
import { buildCreditPassport } from "@/lib/domain/passport";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import type { CreditProfile } from "@/lib/domain/types";

const PROFILE_KEY = "creditquest-profile";

type GuidanceView = "passport" | "readiness";

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isCreditProfile(value: unknown): value is CreditProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;

  return typeof profile.userId === "string"
    && typeof profile.dateOfBirth === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(profile.dateOfBirth)
    && typeof profile.employmentStatus === "string"
    && typeof profile.incomeBand === "string"
    && typeof profile.housingStatus === "string"
    && isNullableBoolean(profile.electoralRoll)
    && isNullableNumber(profile.utilisationPct)
    && isNullableNumber(profile.missedPaymentsLast12m)
    && isNullableNumber(profile.hardApplicationsLast6m)
    && isNullableBoolean(profile.hasRevolvingCredit)
    && isNullableBoolean(profile.hasDirectDebitForCredit);
}

export function DemoCreditGuidance({ view }: { view: GuidanceView }) {
  const [profile, setProfile] = useState<CreditProfile | null | undefined>(undefined);

  useEffect(() => {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    const timer = window.setTimeout(() => {
      if (!raw) {
        setProfile(null);
        return;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        setProfile(isCreditProfile(parsed) ? parsed : null);
      } catch {
        setProfile(null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (profile === undefined) {
    return (
      <div role="status" className="cq-panel rounded-[1.75rem] p-6 text-sm font-bold text-slate-400">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(31,228,255,0.45)]" aria-hidden="true" />
          Loading your guidance…
        </div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <section className="cq-panel relative overflow-hidden rounded-[1.75rem] p-6">
        <div aria-hidden="true" className="absolute -right-16 -top-20 size-48 rounded-full bg-cyan-300/[0.06] blur-3xl" />
        <div className="relative">
          <p className="cq-kicker">We need more information</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Complete your Credit Quest profile</h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-400">
            We will not guess your Passport or application readiness without the profile evidence needed to run the guidance rules.
          </p>
          <Link href="/onboarding" className="mt-5 inline-flex rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
            Complete onboarding
          </Link>
        </div>
      </section>
    );
  }

  const safety = assessSafety(profile);
  const ageMode = getAgeMode(profile.dateOfBirth);
  const diagnosis = diagnoseBarrier(profile);
  const readiness = assessApplicationReadiness(profile, safety, ageMode);
  const passport = buildCreditPassport(profile, readiness);

  void diagnosis;

  return view === "passport"
    ? <PassportDetail passport={passport} />
    : <ReadinessDetail readiness={readiness} />;
}

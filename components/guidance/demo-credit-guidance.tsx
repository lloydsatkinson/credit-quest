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
  }, []);

  if (profile === undefined) {
    return <p role="status" className="py-10 text-sm font-bold text-slate-500">Loading your guidance…</p>;
  }

  if (profile === null) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">We need more information</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Complete your Credit Quest profile</h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-600">
          We will not guess your Passport or application readiness without the profile evidence needed to run the guidance rules.
        </p>
        <Link href="/onboarding" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
          Complete onboarding
        </Link>
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

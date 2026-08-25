import { NextResponse } from "next/server";
import { normaliseOnboardingAnswers } from "@/lib/domain/onboarding";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const env = getSupabasePublicEnv();
    let userId = "demo-user";

    if (env) {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
      userId = user.id;
    }

    const { profile, ageMode } = normaliseOnboardingAnswers(payload, userId);

    if (env) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("profiles").upsert({
        user_id: profile.userId,
        date_of_birth: profile.dateOfBirth,
        employment_status: profile.employmentStatus,
        income_band: profile.incomeBand,
        housing_status: profile.housingStatus,
        electoral_roll: profile.electoralRoll,
        utilisation_pct: profile.utilisationPct,
        missed_payments_last_12m: profile.missedPaymentsLast12m,
        hard_applications_last_6m: profile.hardApplicationsLast6m,
        has_revolving_credit: profile.hasRevolvingCredit,
        has_direct_debit_for_credit: profile.hasDirectDebitForCredit,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    return NextResponse.json({ profile, ageMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid onboarding data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

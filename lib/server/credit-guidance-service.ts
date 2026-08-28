import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveAccountProfileSignals } from "@/lib/domain/account-missions";
import { getAgeMode } from "@/lib/domain/age-gate";
import { diagnoseBarrier } from "@/lib/domain/diagnosis";
import { buildCreditPassport } from "@/lib/domain/passport";
import { assessApplicationReadiness } from "@/lib/domain/readiness";
import { assessSafety } from "@/lib/domain/safety";
import type {
  ApplicationReadiness,
  BarrierDiagnosis,
  CreditPassport,
  CreditProfile,
} from "@/lib/domain/types";
import { listUserAccounts } from "@/lib/server/account-repository";
import { getUserProfile } from "@/lib/server/profile-repository";

export interface CreditGuidance {
  profile: CreditProfile;
  diagnosis: BarrierDiagnosis;
  readiness: ApplicationReadiness;
  passport: CreditPassport;
}

export async function getCreditGuidanceForUser(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<CreditGuidance | null> {
  const profile = await getUserProfile(supabase, userId);
  if (!profile) return null;

  const accounts = await listUserAccounts(supabase, userId);
  const effectiveProfile: CreditProfile = {
    ...profile,
    ...deriveAccountProfileSignals(accounts),
  };

  const safety = assessSafety(effectiveProfile);
  const ageMode = getAgeMode(effectiveProfile.dateOfBirth, now);
  const diagnosis = diagnoseBarrier(effectiveProfile);
  const readiness = assessApplicationReadiness(effectiveProfile, safety, ageMode);
  const passport = buildCreditPassport(effectiveProfile, readiness);

  return {
    profile: effectiveProfile,
    diagnosis,
    readiness,
    passport,
  };
}

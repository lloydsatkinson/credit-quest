import { z } from "zod";
import { getAgeMode, getAgeYears } from "@/lib/domain/age-gate";
import type { CreditProfile } from "@/lib/domain/types";

export const onboardingSchema = z.object({
  dateOfBirth: z.string().min(10),
  employmentStatus: z.enum(["employed", "self_employed", "student", "unemployed", "other"]),
  incomeBand: z.enum(["under_15k", "15_30k", "30_50k", "50k_plus"]),
  housingStatus: z.enum(["owner", "mortgage", "rent", "family", "other"]),
  electoralRoll: z.boolean(),
  utilisationPct: z.number().min(0).max(100).nullable(),
  missedPaymentsLast12m: z.number().int().min(0).max(24),
  hardApplicationsLast6m: z.number().int().min(0).max(30),
  hasRevolvingCredit: z.boolean(),
  hasDirectDebitForCredit: z.boolean(),
});

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export function normaliseOnboardingAnswers(
  answers: OnboardingAnswers,
  userId: string,
  now = new Date(),
): { profile: CreditProfile; ageMode: "education" | "adult" } {
  const parsed = onboardingSchema.parse(answers);
  if (getAgeYears(parsed.dateOfBirth, now) < 16) {
    throw new Error("Credit Quest is currently available from age 16.");
  }
  return {
    profile: { userId, ...parsed },
    ageMode: getAgeMode(parsed.dateOfBirth, now),
  };
}

import { z } from "zod";
import { getAgeMode, getAgeYears } from "@/lib/domain/age-gate";
import type { CreditProfile } from "@/lib/domain/types";

export const onboardingSchema = z.object({
  dateOfBirth: z.string().min(10),
  employmentStatus: z.enum(["employed", "self_employed", "student", "unemployed", "other"]),
  incomeBand: z.enum(["under_15k", "15_30k", "30_50k", "50k_plus", "not_applicable"]),
  housingStatus: z.enum(["owner", "mortgage", "rent", "family", "other"]),
  electoralRoll: z.boolean().nullable(),
  utilisationPct: z.number().min(0).max(100).nullable(),
  missedPaymentsLast12m: z.number().int().min(0).max(24).nullable(),
  hardApplicationsLast6m: z.number().int().min(0).max(30).nullable(),
  hasRevolvingCredit: z.boolean().nullable(),
  hasDirectDebitForCredit: z.boolean().nullable(),
}).superRefine((data, ctx) => {
  if (data.employmentStatus !== "unemployed" && data.incomeBand === "not_applicable") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["incomeBand"],
      message: "Choose an income band for this employment status.",
    });
  }
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

  const incomeBand = parsed.employmentStatus === "unemployed" ? "not_applicable" : parsed.incomeBand;
  const hasRevolvingCredit = parsed.hasRevolvingCredit;
  const utilisationPct = hasRevolvingCredit === false ? null : parsed.utilisationPct;
  const hasDirectDebitForCredit = hasRevolvingCredit === false ? null : parsed.hasDirectDebitForCredit;

  return {
    profile: {
      userId,
      ...parsed,
      incomeBand,
      utilisationPct,
      hasDirectDebitForCredit,
    },
    ageMode: getAgeMode(parsed.dateOfBirth, now),
  };
}

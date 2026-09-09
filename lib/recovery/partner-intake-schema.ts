import { z } from "zod";

export const partnerProductCategorySchema = z.enum([
  "credit_card",
  "loan",
  "overdraft",
  "mortgage",
  "other",
]);

export const partnerDeclineSchema = z.object({
  originReference: z.string().trim().min(1).max(128),
  productCategory: partnerProductCategorySchema,
  declinedAt: z.string().datetime(),
  declineReasonProvided: z.boolean(),
  declineReasonCode: z.string().trim().min(1).max(160).nullable(),
  declineReasonCodes: z.array(z.string().trim().min(1).max(160)).min(1).max(8).optional(),
  attributionKey: z.string().trim().min(1).max(120).nullable().optional(),
  additionalSupportMayBeNeeded: z.boolean().nullable().optional(),
  disclosureVersion: z.string().trim().min(1).max(80).nullable().optional(),
  consentVersion: z.string().trim().min(1).max(80).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  const reasons = [
    value.declineReasonCode,
    ...(value.declineReasonCodes ?? []),
  ].filter((reason): reason is string => Boolean(reason?.trim()));

  if (value.declineReasonProvided && reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declineReasonCode"],
      message: "A reason is required when the partner says one was provided",
    });
  }
});

export type PartnerDeclineInput = z.infer<typeof partnerDeclineSchema>;

export function normalisePartnerReasonCodes(input: Pick<PartnerDeclineInput, "declineReasonCode" | "declineReasonCodes">): string[] {
  const ordered = [input.declineReasonCode, ...(input.declineReasonCodes ?? [])]
    .map((code) => code?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(ordered)];
}

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
  attributionKey: z.string().trim().min(1).max(120).nullable().optional(),
  additionalSupportMayBeNeeded: z.boolean().nullable().optional(),
  disclosureVersion: z.string().trim().min(1).max(80).nullable().optional(),
  consentVersion: z.string().trim().min(1).max(80).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.declineReasonProvided && !value.declineReasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["declineReasonCode"],
      message: "A reason is required when the partner says one was provided",
    });
  }
});

export type PartnerDeclineInput = z.infer<typeof partnerDeclineSchema>;

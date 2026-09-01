import { NextResponse } from "next/server";
import { z } from "zod";
import { approvedPresentationKeys } from "@/lib/experiments/types";
import { requireAdminUser } from "@/lib/server/admin-auth";
import { upsertExperiment } from "@/lib/server/admin-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const experimentSurfaceSchema = z.enum([
  "commercial_route_order",
  "journey_status_copy",
  "journey_email_opt_in_copy",
]);

const experimentVariantSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  presentationKey: z.string().regex(/^[a-z0-9-]+$/),
}).strict();

export const experimentSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  experimentKey: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(["draft", "active", "paused", "ended"]),
  surfaceKey: experimentSurfaceSchema,
  variants: z.array(experimentVariantSchema).min(2).max(10),
}).strict().superRefine((value, context) => {
  const approved = approvedPresentationKeys[value.surfaceKey];
  for (const [index, variant] of value.variants.entries()) {
    if (!approved.includes(variant.presentationKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants", index, "presentationKey"],
        message: "Presentation key is not approved for this experiment surface",
      });
    }
  }
});

export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  const parsed = experimentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid experiment configuration" }, { status: 400 });
  const id = await upsertExperiment(createAdminSupabaseClient(), adminUser.id, {
    experimentId: parsed.data.id ?? null,
    experimentKey: parsed.data.experimentKey,
    status: parsed.data.status,
    surfaceKey: parsed.data.surfaceKey,
    variants: parsed.data.variants,
  });
  return NextResponse.json({ id });
}

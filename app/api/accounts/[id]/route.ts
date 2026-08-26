import { NextResponse } from "next/server";
import { z } from "zod";
import { deactivateUserAccount, updateUserAccount } from "@/lib/server/account-repository";
import { syncTrackedAccountProfileSignals } from "@/lib/server/account-signal-service";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const accountUpdateSchema = z.object({
  providerId: z.string().uuid().nullable().optional(),
  accountType: z.enum(["credit_card", "current_account", "loan", "other"]).optional(),
  nickname: z.string().trim().max(80).nullable().optional(),
  lastFour: z.string().regex(/^\d{4}$/).nullable().optional(),
  balanceMinor: z.number().int().min(0).nullable().optional(),
  creditLimitMinor: z.number().int().positive().nullable().optional(),
  directDebitStatus: z.enum(["yes", "no", "unknown"]).optional(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = accountUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid account update" }, { status: 400 });
  }

  const { id } = await context.params;
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ mode: "demo", id, patch: parsed.data });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const account = await updateUserAccount(supabase, user.id, id, parsed.data);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await syncTrackedAccountProfileSignals(supabase, user.id);
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Could not update account" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!getSupabasePublicEnv()) return new NextResponse(null, { status: 204 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const deactivated = await deactivateUserAccount(supabase, user.id, id);
    if (!deactivated) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    await syncTrackedAccountProfileSignals(supabase, user.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Could not remove account" }, { status: 500 });
  }
}

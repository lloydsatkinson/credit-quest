import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUserAccount, listUserAccounts } from "@/lib/server/account-repository";
import { listAccountProviders } from "@/lib/server/action-repository";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const accountInputSchema = z.object({
  providerId: z.string().uuid().nullable(),
  accountType: z.enum(["credit_card", "current_account", "loan", "other"]),
  nickname: z.string().trim().max(80).nullable(),
  lastFour: z.string().regex(/^\d{4}$/).nullable(),
  balanceMinor: z.number().int().min(0).nullable(),
  creditLimitMinor: z.number().int().positive().nullable(),
  directDebitStatus: z.enum(["yes", "no", "unknown"]),
}).strict();

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ mode: "demo", accounts: [], providers: [] });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const [accounts, providers] = await Promise.all([
      listUserAccounts(supabase, user.id),
      listAccountProviders(supabase),
    ]);
    return NextResponse.json({ accounts, providers });
  } catch {
    return NextResponse.json({ error: "Could not load accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = accountInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid account data" }, { status: 400 });

  if (!getSupabasePublicEnv()) {
    return NextResponse.json({
      mode: "demo",
      account: {
        id: `local:${randomUUID()}`,
        userId: "demo-user",
        ...parsed.data,
        providerName: null,
        currency: "GBP",
        source: "manual",
        active: true,
        lastVerifiedAt: null,
      },
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const account = await createUserAccount(supabase, user.id, parsed.data);
    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save account" }, { status: 500 });
  }
}

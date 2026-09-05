import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SITE_ORIGIN = "https://credit-quest-app.vercel.app";
const PILOT_USER_ID = "ca79d264-e2f1-4467-b655-eb7a66a289fa";
const PILOT_EMAIL = "cq-internal-pilot-3dbb2ff3@example.com";
const HANDOFF_PATH = /^\/recovery\/handoff\/[A-Za-z0-9_-]{43}$/;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function authFailure() {
  return noStore(
    NextResponse.redirect(
      new URL("/login?auth_error=callback_failed", SITE_ORIGIN),
    ),
  );
}

function isExactSyntheticPilot(user: {
  id?: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
} | null | undefined) {
  return user?.id === PILOT_USER_ID
    && user.email?.toLowerCase() === PILOT_EMAIL
    && user.app_metadata?.credit_quest_internal_test === true
    && user.app_metadata?.credit_quest_sandbox_pilot === true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  if (url.origin !== SITE_ORIGIN) return authFailure();

  if (!tokenHash || type !== "magiclink" || !next || !HANDOFF_PATH.test(next)) {
    return authFailure();
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (error) return authFailure();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !isExactSyntheticPilot(userData.user)) {
      await supabase.auth.signOut();
      return authFailure();
    }

    return noStore(NextResponse.redirect(new URL(next, SITE_ORIGIN)));
  } catch {
    return authFailure();
  }
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HANDOFF_PATH = /^\/recovery\/handoff\/[A-Za-z0-9_-]{43}$/;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function authFailure(origin: string) {
  return noStore(
    NextResponse.redirect(
      new URL("/login?auth_error=callback_failed", origin),
    ),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  if (!tokenHash || type !== "magiclink" || !next || !HANDOFF_PATH.test(next)) {
    return authFailure(url.origin);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (error) return authFailure(url.origin);

    return noStore(NextResponse.redirect(new URL(next, url.origin)));
  } catch {
    return authFailure(url.origin);
  }
}

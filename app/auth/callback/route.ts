import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(requestedNext: string | null) {
  return requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/onboarding";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?auth_error=callback_failed", url.origin),
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL("/login?auth_error=callback_failed", url.origin),
      );
    }

    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(
      new URL("/login?auth_error=callback_failed", url.origin),
    );
  }
}

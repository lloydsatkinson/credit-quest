import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const url = new URL(request.url);

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Always return the customer to login even if the server-side session is already absent.
  }

  return NextResponse.redirect(new URL("/login", url.origin), 303);
}

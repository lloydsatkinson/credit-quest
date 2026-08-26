"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const supabase = createBrowserSupabaseClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", "/onboarding");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callback.toString() },
      });
      if (error) throw error;
      setMessage("Check your email for your secure sign-in link.");
    } catch (error) {
      const authError = error as { status?: number; code?: string };
      if (authError?.status === 429 || authError?.code === "over_email_send_rate_limit") {
        setMessage("Too many sign-in emails were requested. Please wait a little and try again.");
      } else {
        setMessage("We could not send a sign-in link right now. Please try again.");
      }
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-16">
      <Link href="/" className="text-sm font-bold text-violet-700">← Credit Quest</Link>
      <h1 className="mt-10 text-4xl font-black">Build better credit habits, one move at a time.</h1>
      <p className="mt-3 text-slate-600">Sign in with your email. We use passwordless access so there is one less password to remember.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm font-bold">Email address
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <button className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-bold text-white">Email me a sign-in link</button>
      </form>
      {message && <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">{message}</p>}
      <Link href="/onboarding" className="mt-6 block text-center text-sm font-bold text-violet-700">Continue in demo mode</Link>
    </main>
  );
}

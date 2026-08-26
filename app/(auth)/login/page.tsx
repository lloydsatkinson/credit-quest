"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { replace } = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const requestedNext = params.get("next");
    const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/onboarding";
    let cancelled = false;

    async function finishMagicLinkSignIn() {
      try {
        setMessage("Signing you in…");
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code as string);
        if (error) throw error;
        if (!cancelled) replace(next);
      } catch {
        if (!cancelled) setMessage("That sign-in link could not be completed. Please request a new one.");
      }
    }

    void finishMagicLinkSignIn();
    return () => { cancelled = true; };
  }, [replace]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (error) throw error;
      setMessage("Check your email for your secure sign-in link.");
    } catch {
      setMessage("Supabase is not configured yet. You can continue in demo mode while V1 is being set up.");
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

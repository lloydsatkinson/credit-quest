"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
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
    <CustomerShell showNav={false}>
      <main className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-lg items-center px-5 py-8 sm:px-6 sm:py-12">
        <div className="w-full">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link href="/" className="text-sm font-black text-cyan-300 transition hover:text-cyan-200">← Credit Quest</Link>
            <span className="rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">
              Passwordless
            </span>
          </div>

          <section
            data-testid="login-panel"
            className="cq-panel relative overflow-hidden rounded-[2rem] p-6 text-white sm:p-8"
          >
            <div aria-hidden="true" className="absolute -right-20 -top-24 size-60 rounded-full bg-cyan-300/[0.075] blur-3xl" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-16 size-52 rounded-full bg-fuchsia-400/[0.05] blur-3xl" />
            <div className="relative">
              <p className="cq-kicker">Secure sign in</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">Build better credit habits, one move at a time.</h1>
              <p className="mt-4 leading-7 text-slate-300">Sign in with your email. We use passwordless access so there is one less password to remember.</p>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <label className="block text-sm font-black text-slate-200">
                  Email address
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-white placeholder:text-slate-600"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <button className="w-full rounded-2xl bg-cyan-300 px-4 py-3.5 font-black text-slate-950 shadow-[0_0_34px_rgba(31,228,255,0.10)] transition hover:bg-cyan-200">
                  Email me a sign-in link
                </button>
              </form>

              {message ? (
                <p role="status" className="mt-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                  {message}
                </p>
              ) : null}

              <div className="mt-6 border-t border-white/8 pt-5 text-center">
                <p className="text-xs leading-5 text-slate-500">Want to explore without signing in?</p>
                <Link href="/onboarding" className="mt-2 inline-flex text-sm font-black text-lime-300 underline decoration-lime-300/25 underline-offset-4 hover:text-white">
                  Continue in demo mode
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </CustomerShell>
  );
}

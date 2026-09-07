"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not log out. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "grid gap-2"}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        aria-label="Log out"
        className={compact
          ? "rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:border-cyan-300/25 hover:text-white disabled:cursor-wait disabled:opacity-60"
          : "inline-flex w-fit items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-300/25 hover:text-white disabled:cursor-wait disabled:opacity-60"}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
      {error ? <span role="alert" className="text-xs font-bold text-rose-300">{error}</span> : null}
    </div>
  );
}

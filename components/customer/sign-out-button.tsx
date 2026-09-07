export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        aria-label="Log out"
        className={compact
          ? "rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:border-cyan-300/25 hover:text-white"
          : "inline-flex w-fit items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-300/25 hover:text-white"}
      >
        Log out
      </button>
    </form>
  );
}

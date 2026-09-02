"use client";

import Link from "next/link";
import { CustomerShell, type CustomerNavKey } from "@/components/customer/customer-shell";

type ShellStateProps = {
  active?: CustomerNavKey;
  showNav?: boolean;
};

function useNav(active: CustomerNavKey | undefined, showNav: boolean | undefined): boolean {
  return showNav ?? Boolean(active);
}

export function CustomerLoadingState({
  label = "Loading your Credit Quest…",
  active,
  showNav,
}: { label?: string } & ShellStateProps) {
  return (
    <CustomerShell active={active} showNav={useNav(active, showNav)}>
      <main className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-2xl items-center px-5 py-10 sm:px-6">
        <section
          data-testid="customer-loading-state"
          role="status"
          aria-live="polite"
          className="cq-panel w-full rounded-[2rem] p-6 sm:p-8"
        >
          <div className="flex items-center gap-4">
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055]" aria-hidden="true">
              <span className="size-2.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(31,228,255,0.6)]" />
            </span>
            <div>
              <p className="cq-kicker">Credit Quest</p>
              <p className="mt-2 font-black text-white">{label}</p>
            </div>
          </div>
        </section>
      </main>
    </CustomerShell>
  );
}

export function CustomerNotFoundState({
  title = "That page is not available",
  body = "Return to your Quest Feed and keep moving from the evidence we do have.",
  href = "/dashboard",
  actionLabel = "Back to Quest",
  active,
  showNav,
}: {
  title?: string;
  body?: string;
  href?: string;
  actionLabel?: string;
} & ShellStateProps) {
  return (
    <CustomerShell active={active} showNav={useNav(active, showNav)}>
      <main className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-2xl items-center px-5 py-10 sm:px-6">
        <section data-testid="customer-not-found-state" className="cq-panel relative w-full overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-56 rounded-full bg-cyan-300/[0.055] blur-3xl" />
          <div className="relative">
            <p className="cq-kicker">Nothing to action here</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{body}</p>
            <Link href={href} className="mt-6 inline-flex rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-200">
              {actionLabel}
            </Link>
          </div>
        </section>
      </main>
    </CustomerShell>
  );
}

export function CustomerErrorState({
  reset,
  title = "Something interrupted this screen",
  body = "Your Credit Quest data has not been changed. Try the screen again or return to your Quest Feed.",
  active,
  showNav,
}: {
  reset: () => void;
  title?: string;
  body?: string;
} & ShellStateProps) {
  return (
    <CustomerShell active={active} showNav={useNav(active, showNav)}>
      <main className="mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-2xl items-center px-5 py-10 sm:px-6">
        <section data-testid="customer-error-state" role="alert" className="cq-panel relative w-full overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-56 rounded-full bg-fuchsia-400/[0.05] blur-3xl" />
          <div className="relative">
            <p className="cq-kicker">Screen interrupted</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{body}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={reset} className="rounded-2xl bg-cyan-300 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-200">
                Try again
              </button>
              <Link href="/dashboard" className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 font-black text-slate-200 transition hover:bg-white/[0.07] hover:text-white">
                Back to Quest
              </Link>
            </div>
          </div>
        </section>
      </main>
    </CustomerShell>
  );
}

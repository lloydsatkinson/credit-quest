import Link from "next/link";
import { CustomerShell } from "@/components/customer/customer-shell";

export default function HomePage() {
  return (
    <CustomerShell showNav={false} showHeader={false}>
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-10 pt-6 sm:px-8 sm:pt-10 lg:justify-center">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="Credit Quest home">
            <span className="grid size-11 place-items-center rounded-[1rem] border border-cyan-300/30 bg-[#0b1320] text-xs font-black tracking-[-0.07em] text-white shadow-[0_0_28px_rgba(31,228,255,0.12)]">CQ</span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.18em] text-white">Credit Quest</span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Help first. Fun throughout.</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-black text-slate-300 hover:border-cyan-300/25 hover:text-white">
            Sign in
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/[0.055] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-lime-300">
              <span className="size-1.5 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(200,255,56,0.7)]" aria-hidden="true" />
              Fintech meets gaming — without making borrowing the game
            </div>
            <h1 className="mt-6 text-5xl font-black leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
              Know your next move.
              <span className="mt-2 block bg-gradient-to-r from-cyan-300 via-white to-lime-300 bg-clip-text text-transparent">Know when you’re ready.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-300 sm:text-xl">
              Credit Quest turns confusing credit information into a finite personalised journey: understand your position, take one useful action, then reassess.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              No fake credit score. No approval promises. No pressure to borrow just to keep playing.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="rounded-2xl bg-lime-300 px-6 py-4 text-center text-sm font-black text-slate-950 shadow-[0_0_36px_rgba(200,255,56,0.14)] hover:bg-lime-200" href="/onboarding">
                Start my quest →
              </Link>
              <Link className="rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] px-6 py-4 text-center text-sm font-black text-cyan-200 hover:border-cyan-300/35 hover:text-white" href="/dashboard">
                Explore the demo
              </Link>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                ["UNDERSTAND", "See what is helping, hurting or still unknown", "text-cyan-300"],
                ["ACT", "Get one clear next move instead of a long checklist", "text-fuchsia-300"],
                ["PROGRESS", "Track genuine evidence and readiness over time", "text-lime-300"],
              ].map(([label, copy, accent]) => (
                <div key={label} className="rounded-2xl border border-white/7 bg-white/[0.025] p-4">
                  <p className={`text-[10px] font-black tracking-[0.16em] ${accent}`}>{label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-10 rounded-full bg-cyan-300/[0.055] blur-3xl" aria-hidden="true" />
            <div className="cq-panel relative overflow-hidden rounded-[2.5rem] p-4 shadow-[0_45px_120px_rgba(0,0,0,0.48)] sm:p-5">
              <div className="rounded-[2rem] border border-white/8 bg-[#060a11] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-300">Your momentum</span>
                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">1 of 7</span>
                </div>
                <div className="mt-7 flex items-center gap-4">
                  <div className="relative grid size-24 shrink-0 place-items-center rounded-full border-[7px] border-cyan-300/70 shadow-[0_0_32px_rgba(31,228,255,0.12)]">
                    <div className="absolute -inset-[7px] rounded-full border-[7px] border-r-lime-300/80 border-b-fuchsia-300/70 border-l-transparent border-t-transparent rotate-45" aria-hidden="true" />
                    <span className="text-center text-[9px] font-black uppercase tracking-[0.12em] text-white">Credit<br /><span className="text-sm tracking-[-0.04em]">Passport</span></span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-lime-300">Your next move</p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-white">Lower your utilisation</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-500">One useful mission. A clear reason. Then reassess.</p>
                  </div>
                </div>
                <div className="mt-7 rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-white">Take action</span>
                    <span className="text-lg text-lime-300">→</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-5 gap-1 border-t border-white/7 pt-4 text-center text-[8px] font-black uppercase tracking-[0.08em] text-slate-600">
                  <span className="text-lime-300">Quest</span><span>Passport</span><span>Ready</span><span>Learn</span><span>Profile</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/6 pt-5 text-xs leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>Credit Quest guidance is educational and does not guarantee lender approval or changes to a bureau credit score.</p>
          <Link href="/learn" className="shrink-0 font-black text-cyan-300 hover:text-white">Explore the Academy →</Link>
        </footer>
      </main>
    </CustomerShell>
  );
}

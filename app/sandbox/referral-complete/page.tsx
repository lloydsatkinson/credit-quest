import Link from "next/link";

export default function SandboxReferralCompletePage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-12">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Credit Quest sandbox</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Sandbox journey complete</h1>
        <p className="mt-4 leading-7 text-slate-700">
          No lender or credit application was contacted. This page only proves Credit Quest’s consent,
          attribution and safety plumbing.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white"
        >
          Back to Credit Quest
        </Link>
      </section>
    </main>
  );
}

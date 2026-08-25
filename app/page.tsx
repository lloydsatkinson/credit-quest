import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-6 inline-flex w-fit rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-sm font-semibold text-violet-700 shadow-sm">
        Credit building, made actionable
      </div>
      <h1 className="text-5xl font-black tracking-tight text-slate-950">Your next best move for better credit.</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        Credit Quest turns your credit profile into clear missions, explains why each one matters, and tracks your progress without pretending to be a credit bureau.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link className="rounded-2xl bg-violet-600 px-5 py-3 text-center font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700" href="/onboarding">
          Start my quest
        </Link>
        <Link className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center font-bold text-slate-700" href="/dashboard">
          View demo dashboard
        </Link>
      </div>
      <p className="mt-8 text-sm text-slate-500">Credit Quest guidance is educational and does not guarantee approval or changes to a bureau credit score.</p>
    </main>
  );
}

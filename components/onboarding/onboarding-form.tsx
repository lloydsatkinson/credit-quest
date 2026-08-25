"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAnswers } from "@/lib/domain/onboarding";

const stepNames = ["Basics", "Work", "Home", "Identity", "Credit", "Payments", "Applications", "Finish"];

const initial: OnboardingAnswers = {
  dateOfBirth: "",
  employmentStatus: "employed",
  incomeBand: "30_50k",
  housingStatus: "rent",
  electoralRoll: false,
  utilisationPct: null,
  missedPaymentsLast12m: 0,
  hardApplicationsLast6m: 0,
  hasRevolvingCredit: false,
  hasDirectDebitForCredit: false,
};

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(initial);
  const [error, setError] = useState("");
  const progress = useMemo(() => Math.round(((step + 1) / stepNames.length) * 100), [step]);

  async function finish() {
    setError("");
    const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(answers) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "We could not save your answers."); return; }
    localStorage.setItem("creditquest-profile", JSON.stringify(data.profile));
    localStorage.setItem("creditquest-age-mode", data.ageMode);
    router.push("/dashboard");
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500"><span>{stepNames[step]}</span><span>{progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} /></div>
      </div>

      {step === 0 && <Field title="When were you born?" hint="Credit Quest is available from age 16. Credit product referrals are only available from 18."><input data-testid="dob" type="date" className="field" value={answers.dateOfBirth} onChange={(e) => setAnswers({ ...answers, dateOfBirth: e.target.value })} /></Field>}
      {step === 1 && <Field title="What best describes your work?" hint="We use broad bands only for V1."><Select value={answers.employmentStatus} onChange={(v) => setAnswers({ ...answers, employmentStatus: v as OnboardingAnswers["employmentStatus"] })} options={["employed","self_employed","student","unemployed","other"]} /><Select value={answers.incomeBand} onChange={(v) => setAnswers({ ...answers, incomeBand: v as OnboardingAnswers["incomeBand"] })} options={["under_15k","15_30k","30_50k","50k_plus"]} /></Field>}
      {step === 2 && <Field title="What is your housing situation?" hint="This gives context to your profile, not a judgement."><Select value={answers.housingStatus} onChange={(v) => setAnswers({ ...answers, housingStatus: v as OnboardingAnswers["housingStatus"] })} options={["owner","mortgage","rent","family","other"]} /></Field>}
      {step === 3 && <Field title="Are you on the electoral roll at your current address?" hint="This can help with identity and address matching."><YesNo value={answers.electoralRoll} onChange={(v) => setAnswers({ ...answers, electoralRoll: v })} /></Field>}
      {step === 4 && <Field title="Do you already have a credit card or other revolving credit?" hint="If yes, tell us roughly how much of your total limit you use."><YesNo value={answers.hasRevolvingCredit} onChange={(v) => setAnswers({ ...answers, hasRevolvingCredit: v, utilisationPct: v ? (answers.utilisationPct ?? 30) : null })} />{answers.hasRevolvingCredit && <input aria-label="Credit utilisation percentage" className="field" type="number" min="0" max="100" value={answers.utilisationPct ?? 0} onChange={(e) => setAnswers({ ...answers, utilisationPct: Number(e.target.value) })} />}</Field>}
      {step === 5 && <Field title="Any missed payments in the last 12 months?" hint="And if you use revolving credit, do you protect payments with a direct debit?"><input aria-label="Missed payments" className="field" type="number" min="0" value={answers.missedPaymentsLast12m} onChange={(e) => setAnswers({ ...answers, missedPaymentsLast12m: Number(e.target.value) })} />{answers.hasRevolvingCredit && <YesNo label="Direct debit set up" value={answers.hasDirectDebitForCredit} onChange={(v) => setAnswers({ ...answers, hasDirectDebitForCredit: v })} />}</Field>}
      {step === 6 && <Field title="How many hard credit applications in the last 6 months?" hint="An estimate is fine."><input aria-label="Hard applications" className="field" type="number" min="0" value={answers.hardApplicationsLast6m} onChange={(e) => setAnswers({ ...answers, hardApplicationsLast6m: Number(e.target.value) })} /></Field>}
      {step === 7 && <Field title="Ready for your first mission?" hint="We’ll use these answers to choose one explainable next best move."><div className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">Your Credit Quest Score is our own progress indicator. It is not an Experian, Equifax or TransUnion score and does not predict lender approval.</div></Field>}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="mt-8 flex gap-3">
        {step > 0 && <button className="rounded-2xl border border-slate-200 px-4 py-3 font-bold" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 7 ? <button data-testid="next" disabled={step === 0 && !answers.dateOfBirth} className="ml-auto rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-40" onClick={() => setStep(step + 1)}>Next</button> : <button data-testid="finish" className="ml-auto rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white" onClick={finish}>Show my next best move</button>}
      </div>
      <style jsx>{`.field{width:100%;margin-top:12px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#fff}`}</style>
    </div>
  );
}

function Field({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) { return <div><h2 className="text-2xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p><div className="mt-4 space-y-3">{children}</div></div>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select aria-label="Select option" className="field w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o.replaceAll("_", " ")}</option>)}</select>; }
function YesNo({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label?: string }) { return <div><p className="mb-2 text-sm font-bold">{label}</p><div className="grid grid-cols-2 gap-3"><button type="button" className={`rounded-2xl border px-4 py-3 font-bold ${value ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200"}`} onClick={() => onChange(true)}>Yes</button><button type="button" className={`rounded-2xl border px-4 py-3 font-bold ${!value ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200"}`} onClick={() => onChange(false)}>No</button></div></div>; }

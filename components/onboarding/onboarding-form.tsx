"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingAnswers } from "@/lib/domain/onboarding";

const stepNames = ["Basics", "Work", "Home", "Identity", "Credit", "Payments", "Applications", "Finish"];

type OnboardingDraft = Omit<OnboardingAnswers, "employmentStatus" | "incomeBand" | "housingStatus"> & {
  employmentStatus: OnboardingAnswers["employmentStatus"] | null;
  incomeBand: OnboardingAnswers["incomeBand"] | null;
  housingStatus: OnboardingAnswers["housingStatus"] | null;
};

const initial: OnboardingDraft = {
  dateOfBirth: "",
  employmentStatus: null,
  incomeBand: null,
  housingStatus: null,
  electoralRoll: null,
  utilisationPct: null,
  missedPaymentsLast12m: null,
  hardApplicationsLast6m: null,
  hasRevolvingCredit: null,
  hasDirectDebitForCredit: null,
};

function canContinue(step: number, answers: OnboardingDraft, answered: Set<string>): boolean {
  switch (step) {
    case 0:
      return Boolean(answers.dateOfBirth);
    case 1:
      return Boolean(answers.employmentStatus) &&
        (answers.employmentStatus === "unemployed" || answers.incomeBand !== null);
    case 2:
      return Boolean(answers.housingStatus);
    case 3:
      return answered.has("electoralRoll");
    case 4:
      return answered.has("hasRevolvingCredit") &&
        (answers.hasRevolvingCredit !== true || answered.has("utilisationPct"));
    case 5:
      return answered.has("missedPaymentsLast12m") &&
        (answers.hasRevolvingCredit !== true || answered.has("hasDirectDebitForCredit"));
    case 6:
      return answered.has("hardApplicationsLast6m");
    default:
      return true;
  }
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingDraft>(initial);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const progress = useMemo(() => Math.round(((step + 1) / stepNames.length) * 100), [step]);

  function markAnswered(key: string) {
    setAnswered((current) => new Set(current).add(key));
  }

  function updateEmploymentStatus(status: OnboardingAnswers["employmentStatus"]) {
    setAnswers((current) => ({
      ...current,
      employmentStatus: status,
      incomeBand: status === "unemployed" ? "not_applicable" : current.incomeBand === "not_applicable" ? null : current.incomeBand,
    }));
  }

  function updateRevolvingCredit(hasRevolvingCredit: boolean | null) {
    setAnswers((current) => ({
      ...current,
      hasRevolvingCredit,
      utilisationPct: null,
      hasDirectDebitForCredit: hasRevolvingCredit === true ? current.hasDirectDebitForCredit : null,
    }));
    setAnswered((current) => {
      const next = new Set(current);
      next.add("hasRevolvingCredit");
      next.delete("utilisationPct");
      if (hasRevolvingCredit !== true) next.delete("hasDirectDebitForCredit");
      return next;
    });
  }

  async function finish() {
    setError("");
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(answers),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "We could not save your answers.");
      return;
    }
    localStorage.setItem("creditquest-profile", JSON.stringify(data.profile));
    localStorage.setItem("creditquest-age-mode", data.ageMode);
    router.push("/dashboard");
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
          <span>{stepNames[step]}</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step === 0 && (
        <Field title="When were you born?" hint="Credit Quest is available from age 16. Credit product referrals are only available from 18.">
          <input data-testid="dob" type="date" className="field" value={answers.dateOfBirth} onChange={(e) => setAnswers({ ...answers, dateOfBirth: e.target.value })} />
        </Field>
      )}

      {step === 1 && (
        <Field title="What best describes your work?" hint="Tell us your current employment status. If you are working, we only need a broad annual income band.">
          <label className="block text-sm font-bold text-slate-700">
            Employment status
            <Select
              ariaLabel="Employment status"
              placeholder="Choose one"
              value={answers.employmentStatus ?? ""}
              onChange={(value) => updateEmploymentStatus(value as OnboardingAnswers["employmentStatus"])}
              options={["employed", "self_employed", "student", "unemployed", "other"]}
            />
          </label>
          {answers.employmentStatus === "unemployed" ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No income band is needed while you are unemployed.</p>
          ) : answers.employmentStatus ? (
            <label className="block text-sm font-bold text-slate-700">
              Annual personal income (before tax)
              <Select
                ariaLabel="Annual personal income band"
                placeholder="Choose a band"
                value={answers.incomeBand ?? ""}
                onChange={(value) => setAnswers({ ...answers, incomeBand: value as OnboardingAnswers["incomeBand"] })}
                options={["under_15k", "15_30k", "30_50k", "50k_plus"]}
              />
            </label>
          ) : null}
        </Field>
      )}

      {step === 2 && (
        <Field title="What is your housing situation?" hint="This gives context to your profile, not a judgement.">
          <Select
            ariaLabel="Housing situation"
            placeholder="Choose one"
            value={answers.housingStatus ?? ""}
            onChange={(value) => setAnswers({ ...answers, housingStatus: value as OnboardingAnswers["housingStatus"] })}
            options={["owner", "mortgage", "rent", "family", "other"]}
          />
        </Field>
      )}

      {step === 3 && (
        <Field title="Are you on the electoral roll at your current address?" hint="This can help with identity and address matching. If you are not sure, tell us that rather than guessing.">
          <YesNoUnknown
            value={answers.electoralRoll}
            answered={answered.has("electoralRoll")}
            onChange={(value) => {
              setAnswers({ ...answers, electoralRoll: value });
              markAnswered("electoralRoll");
            }}
          />
        </Field>
      )}

      {step === 4 && (
        <Field title="Do you already have a credit card or other revolving credit?" hint="If yes, tell us the percentage of your total available credit that you are currently using. If you do not know, that is fine.">
          <YesNoUnknown
            value={answers.hasRevolvingCredit}
            answered={answered.has("hasRevolvingCredit")}
            onChange={updateRevolvingCredit}
          />
          {answers.hasRevolvingCredit === true && (
            <div>
              <label className="block text-sm font-bold text-slate-700">
                Credit utilisation (%)
                <input
                  aria-label="Credit utilisation (%)"
                  className="field"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  placeholder="e.g. 30"
                  value={answers.utilisationPct ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAnswers({ ...answers, utilisationPct: value === "" ? null : Number(value) });
                    if (value !== "") markAnswered("utilisationPct");
                  }}
                />
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
                  Enter the percentage, not a £ value. For example, £600 owed across £2,000 of total credit limits is 30% — enter 30.
                </span>
              </label>
              <button
                type="button"
                className="mt-3 text-sm font-bold text-violet-700 underline"
                onClick={() => {
                  setAnswers({ ...answers, utilisationPct: null });
                  markAnswered("utilisationPct");
                }}
              >
                I don&apos;t know my utilisation
              </button>
            </div>
          )}
        </Field>
      )}

      {step === 5 && (
        <Field title="Any missed payments in the last 12 months?" hint="An estimate is useful, but do not guess if you are unsure. If you use revolving credit, we will also ask whether a direct debit protects your payments.">
          <label className="block text-sm font-bold text-slate-700">
            Number of missed payments
            <input
              aria-label="Missed payments"
              className="field"
              type="number"
              min="0"
              value={answers.missedPaymentsLast12m ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                setAnswers({ ...answers, missedPaymentsLast12m: value === "" ? null : Number(value) });
                if (value !== "") markAnswered("missedPaymentsLast12m");
              }}
            />
          </label>
          <button
            type="button"
            className="text-sm font-bold text-violet-700 underline"
            onClick={() => {
              setAnswers({ ...answers, missedPaymentsLast12m: null });
              markAnswered("missedPaymentsLast12m");
            }}
          >
            I don&apos;t know how many
          </button>
          {answers.hasRevolvingCredit === true && (
            <YesNoUnknown
              label="Direct debit set up"
              value={answers.hasDirectDebitForCredit}
              answered={answered.has("hasDirectDebitForCredit")}
              onChange={(value) => {
                setAnswers({ ...answers, hasDirectDebitForCredit: value });
                markAnswered("hasDirectDebitForCredit");
              }}
            />
          )}
        </Field>
      )}

      {step === 6 && (
        <Field title="How many hard credit applications in the last 6 months?" hint="An estimate is fine. If you genuinely do not know, tell us that instead of entering zero.">
          <input
            aria-label="Hard applications"
            className="field"
            type="number"
            min="0"
            value={answers.hardApplicationsLast6m ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setAnswers({ ...answers, hardApplicationsLast6m: value === "" ? null : Number(value) });
              if (value !== "") markAnswered("hardApplicationsLast6m");
            }}
          />
          <button
            type="button"
            className="text-sm font-bold text-violet-700 underline"
            onClick={() => {
              setAnswers({ ...answers, hardApplicationsLast6m: null });
              markAnswered("hardApplicationsLast6m");
            }}
          >
            I don&apos;t know
          </button>
        </Field>
      )}

      {step === 7 && (
        <Field title="Ready for your first mission?" hint="We’ll use only the answers you gave us to choose one explainable next best move.">
          <div className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-900">Your Credit Quest Score is our own progress indicator. It is not an Experian, Equifax or TransUnion score and does not predict lender approval.</div>
        </Field>
      )}

      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="mt-8 flex gap-3">
        {step > 0 && <button className="rounded-2xl border border-slate-200 px-4 py-3 font-bold" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 7 ? (
          <button data-testid="next" disabled={!canContinue(step, answers, answered)} className="ml-auto rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-40" onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button data-testid="finish" className="ml-auto rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white" onClick={finish}>Show my next best move</button>
        )}
      </div>
      <style jsx>{`.field{width:100%;margin-top:12px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:#fff}`}</style>
    </div>
  );
}

function Field({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <div><h2 className="text-2xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p><div className="mt-4 space-y-3">{children}</div></div>;
}

function Select({ ariaLabel, value, onChange, options, placeholder }: { ariaLabel: string; value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
  return (
    <select aria-label={ariaLabel} className="field w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
    </select>
  );
}

function YesNoUnknown({ value, onChange, label, answered }: { value: boolean | null; onChange: (value: boolean | null) => void; label?: string; answered: boolean }) {
  const options = [
    { label: "Yes", value: true },
    { label: "No", value: false },
    { label: "I don't know", value: null },
  ] as const;

  return (
    <div>
      {label && <p className="mb-2 text-sm font-bold">{label}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const selected = answered && value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              className={`rounded-2xl border px-4 py-3 font-bold ${selected ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200"}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

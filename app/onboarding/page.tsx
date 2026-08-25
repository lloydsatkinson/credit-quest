import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between"><Link href="/" className="font-black text-violet-700">Credit Quest</Link><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Private by design</span></div>
      <OnboardingForm />
    </main>
  );
}

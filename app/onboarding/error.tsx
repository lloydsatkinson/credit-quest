"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} showNav={false} title="Profile setup was interrupted" body="No answer needs to be guessed. Try loading the questions again when you are ready." />;
}

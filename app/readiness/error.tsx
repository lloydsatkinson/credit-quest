"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} active="readiness" title="Readiness guidance could not be shown" body="Do not make an application just to test the market. Try loading the evidence-based guidance again." />;
}

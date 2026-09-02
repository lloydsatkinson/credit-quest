"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} active="passport" title="Your Passport could not be shown" body="Credit Quest has not changed your evidence. Try loading the Passport again." />;
}

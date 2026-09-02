"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} active="readiness" title="Optional routes are unavailable" body="Your Credit Quest plan can continue without a product referral. Try this screen again later." />;
}

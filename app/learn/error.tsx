"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} active="learn" title="The Academy hit a temporary problem" body="Your main Credit Quest journey is unaffected. Try loading this learning screen again." />;
}

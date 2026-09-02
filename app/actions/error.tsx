"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} active="quest" title="This mission action could not be loaded" body="No action has been marked complete. Try loading the safe action journey again." />;
}

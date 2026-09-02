"use client";

import { CustomerErrorState } from "@/components/customer/customer-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerErrorState reset={reset} showNav={false} title="Sign in could not be shown" body="No account settings have changed. Try loading the passwordless sign-in screen again." />;
}

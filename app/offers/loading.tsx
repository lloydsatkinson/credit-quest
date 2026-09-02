import { CustomerLoadingState } from "@/components/customer/customer-state";

export default function Loading() {
  return <CustomerLoadingState label="Checking optional routes…" active="readiness" />;
}

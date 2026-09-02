import { CustomerLoadingState } from "@/components/customer/customer-state";

export default function Loading() {
  return <CustomerLoadingState label="Loading your Quest Feed…" active="quest" />;
}

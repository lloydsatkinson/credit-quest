import { CustomerLoadingState } from "@/components/customer/customer-state";

export default function Loading() {
  return <CustomerLoadingState label="Loading the Academy…" active="learn" />;
}

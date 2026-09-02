import { CustomerLoadingState } from "@/components/customer/customer-state";

export default function Loading() {
  return <CustomerLoadingState label="Preparing your starting questions…" showNav={false} />;
}

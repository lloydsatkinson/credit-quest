import { CustomerNotFoundState } from "@/components/customer/customer-state";

export default function NotFound() {
  return <CustomerNotFoundState title="That mission action is not available" body="Return to your Quest Feed to use the current action Credit Quest can safely resolve." active="quest" />;
}

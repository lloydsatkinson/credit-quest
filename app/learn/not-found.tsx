import { CustomerNotFoundState } from "@/components/customer/customer-state";

export default function NotFound() {
  return <CustomerNotFoundState title="That Academy lesson is not available" body="It may have been replaced or unpublished. Browse the reviewed lessons that are available now." href="/learn" actionLabel="Back to Academy" active="learn" />;
}

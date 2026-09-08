import "server-only";
import { createHmac } from "node:crypto";

export function getLenderPilotReferenceSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env.LENDER_PILOT_REFERENCE_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function createLenderPilotCaseReference(
  secret: string,
  recoveryJourneyId: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(recoveryJourneyId)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `CQ-${digest}`;
}

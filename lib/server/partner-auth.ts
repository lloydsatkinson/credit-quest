import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SAFE_KEY = /^[A-Za-z0-9._:-]{3,160}$/;
const SAFE_NONCE = /^[A-Za-z0-9_-]{8,160}$/;
const HEX_SHA256 = /^[a-fA-F0-9]{64}$/;

export class PartnerAuthError extends Error {
  constructor(message = "Partner request authentication failed") {
    super(message);
    this.name = "PartnerAuthError";
  }
}

export interface PartnerAuthHeaders {
  credentialKey: string;
  timestamp: string;
  nonce: string;
  idempotencyKey: string;
  signature: string;
}

function requiredHeader(headers: Headers, name: string) {
  const value = headers.get(name)?.trim();
  if (!value) throw new PartnerAuthError();
  return value;
}

export function readPartnerAuthHeaders(headers: Headers): PartnerAuthHeaders {
  const auth = {
    credentialKey: requiredHeader(headers, "x-cq-partner-credential"),
    timestamp: requiredHeader(headers, "x-cq-timestamp"),
    nonce: requiredHeader(headers, "x-cq-nonce"),
    idempotencyKey: requiredHeader(headers, "x-cq-idempotency-key"),
    signature: requiredHeader(headers, "x-cq-signature"),
  };

  if (!SAFE_KEY.test(auth.credentialKey)) throw new PartnerAuthError();
  if (!SAFE_NONCE.test(auth.nonce)) throw new PartnerAuthError();
  if (!SAFE_KEY.test(auth.idempotencyKey)) throw new PartnerAuthError();
  if (!HEX_SHA256.test(auth.signature)) throw new PartnerAuthError();
  if (!Number.isFinite(Date.parse(auth.timestamp))) throw new PartnerAuthError();

  return auth;
}

export function assertFreshPartnerTimestamp(timestamp: string, now: Date) {
  const requestTime = Date.parse(timestamp);
  if (!Number.isFinite(requestTime)) throw new PartnerAuthError();
  if (Math.abs(now.getTime() - requestTime) > MAX_CLOCK_SKEW_MS) {
    throw new PartnerAuthError();
  }
}

export function buildCanonicalPartnerRequest(
  bodyText: string,
  auth: Pick<PartnerAuthHeaders, "credentialKey" | "timestamp" | "nonce" | "idempotencyKey">,
) {
  return [
    "POST",
    "/api/partner/declines",
    auth.credentialKey,
    auth.timestamp,
    auth.nonce,
    auth.idempotencyKey,
    bodyText,
  ].join("\n");
}

export function resolvePartnerSecret(secretReference: string) {
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(secretReference)) {
    throw new PartnerAuthError();
  }
  const secret = process.env[secretReference];
  if (!secret || secret.length < 32) throw new PartnerAuthError();
  return secret;
}

export function verifyPartnerRequestSignature(
  bodyText: string,
  auth: PartnerAuthHeaders,
  secret: string,
) {
  const expectedHex = createHmac("sha256", secret)
    .update(buildCanonicalPartnerRequest(bodyText, auth))
    .digest("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const supplied = Buffer.from(auth.signature, "hex");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new PartnerAuthError();
  }
}

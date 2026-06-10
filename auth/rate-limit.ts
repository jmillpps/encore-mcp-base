import type { RateLimitBucket, ServiceConfig } from "../shared/config.ts";
import { sha256Base64Url } from "../shared/crypto.ts";
import { emitDiagnostic } from "../shared/diagnostics.ts";
import { ServiceError } from "../shared/errors.ts";
import { authorizationCredentials } from "./authorization-header.ts";
import { decodeBasicCredentials } from "./basic-credentials.ts";
import { rateLimitStore } from "./storage/store-provider.ts";

export async function enforceRateLimit(config: ServiceConfig, bucket: RateLimitBucket, subject: string): Promise<void> {
  const normalized = subject.trim() || "anonymous";
  const subjectHash = sha256Base64Url(normalized);
  const key = `${bucket}:${subjectHash}`;
  const policy = config.rateLimitPolicies[bucket];
  try {
    await rateLimitStore(config).hit(key, policy);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "rate_limited") {
      emitDiagnostic("warn", "rate_limit_exceeded", { bucket, subjectHash, windowSeconds: policy.windowSeconds, maxRequests: policy.maxRequests });
    }
    throw error;
  }
}

export function clientRateSubject(clientId: string | null | undefined, fallback: string): string {
  return clientId?.trim() ? `client:${clientId}` : `remote:${fallback}`;
}

export function tokenRateSubject(form: URLSearchParams, authorization: string | undefined, fallback: string): string {
  const formClientId = form.get("client_id");
  if (formClientId?.trim()) return clientRateSubject(formClientId, fallback);
  return clientRateSubject(basicClientId(authorization), fallback);
}

function basicClientId(authorization: string | undefined): string | undefined {
  const credentials = authorizationCredentials(authorization, "Basic");
  if (credentials === undefined) return undefined;
  return decodeBasicCredentials(credentials)?.clientId;
}

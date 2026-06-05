import type { ServiceConfig } from "../shared/config.ts";
import { sha256Base64Url } from "../shared/crypto.ts";
import { DiskRateLimitStore } from "./storage/rate-limit-store.ts";

export type RateLimitBucket = "oauth-authorize" | "oauth-token" | "oauth-userinfo" | "mcp-tool";

export async function enforceRateLimit(config: ServiceConfig, bucket: RateLimitBucket, subject: string): Promise<void> {
  const normalized = subject.trim() || "anonymous";
  const key = `${bucket}:${sha256Base64Url(normalized)}`;
  await new DiskRateLimitStore(config.oauthStorePath).hit(key, config.rateLimitWindowSeconds, config.rateLimitMaxRequests);
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
  if (!authorization?.startsWith("Basic ")) return undefined;
  try {
    const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return undefined;
    return decodeURIComponent(decoded.slice(0, separator));
  } catch {
    return undefined;
  }
}

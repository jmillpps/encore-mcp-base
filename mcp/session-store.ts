import type { ServiceConfig } from "../shared/config.ts";
import { randomToken, sha256Base64Url } from "../shared/crypto.ts";
import { nowSeconds } from "../shared/time.ts";
import { DiskOAuthStore } from "../auth/storage/disk-store.ts";

export async function createMcpSession(config: ServiceConfig, protocolVersion: string): Promise<string> {
  const sessionId = randomToken(24);
  const now = nowSeconds();
  await new DiskOAuthStore(config.oauthStorePath).saveMcpSession({
    sessionIdHash: sha256Base64Url(sessionId),
    clientId: "anonymous",
    protocolVersion,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + 3600,
  });
  return sessionId;
}

export async function touchMcpSession(config: ServiceConfig, sessionId: string, protocolVersion: string): Promise<void> {
  await new DiskOAuthStore(config.oauthStorePath).touchMcpSession(sha256Base64Url(sessionId), protocolVersion);
}

export async function terminateMcpSession(config: ServiceConfig, sessionId: string): Promise<void> {
  await new DiskOAuthStore(config.oauthStorePath).terminateMcpSession(sha256Base64Url(sessionId));
}

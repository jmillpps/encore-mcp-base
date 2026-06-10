import type { ServiceConfig } from "../shared/config.ts";
import { randomToken, sha256Base64Url } from "../shared/crypto.ts";
import { nowSeconds } from "../shared/time.ts";
import { oauthStore } from "../auth/storage/store-provider.ts";
import type { JsonRpcId } from "./json-rpc.ts";
import { duplicateRequestIdError, mcpRequestIdHash } from "./request-id.ts";

export async function createMcpSession(config: ServiceConfig, protocolVersion: string, clientId: string): Promise<string> {
  const sessionId = randomToken(24);
  const now = nowSeconds();
  await oauthStore(config).saveMcpSession({
    sessionIdHash: sha256Base64Url(sessionId),
    clientId,
    protocolVersion,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + 3600,
    requestIdHashes: [],
  });
  return sessionId;
}

export async function touchMcpSession(config: ServiceConfig, sessionId: string, protocolVersion: string | undefined, markInitialized = false): Promise<{ initialized: boolean }> {
  return oauthStore(config).touchMcpSession(sha256Base64Url(sessionId), protocolVersion, markInitialized);
}

export async function reserveMcpRequestId(config: ServiceConfig, sessionId: string, id: JsonRpcId): Promise<void> {
  const reserved = await oauthStore(config).reserveMcpRequestId(sha256Base64Url(sessionId), mcpRequestIdHash(id));
  if (!reserved) throw duplicateRequestIdError();
}

export async function terminateMcpSession(config: ServiceConfig, sessionId: string): Promise<void> {
  await oauthStore(config).terminateMcpSession(sha256Base64Url(sessionId));
}

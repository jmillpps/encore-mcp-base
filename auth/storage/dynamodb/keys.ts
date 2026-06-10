import { stringAttr } from "./attribute-value.ts";
import type { DynamoDbItem } from "./attribute-value.ts";

export function authorizationCodeKey(codeHash: string): DynamoDbItem {
  return key(`AUTH_CODE#${codeHash}`, "STATE");
}

export function upstreamStateKey(stateHash: string): DynamoDbItem {
  return key(`UPSTREAM_STATE#${stateHash}`, "STATE");
}

export function refreshTokenKey(tokenHash: string): DynamoDbItem {
  return key(`REFRESH#${tokenHash}`, "TOKEN");
}

export function refreshFamilyKey(familyId: string): DynamoDbItem {
  return key(`REFRESH_FAMILY#${familyId}`, "META");
}

export function refreshRotationKey(oldTokenHash: string): DynamoDbItem {
  return key(`REFRESH_ROTATED#${oldTokenHash}`, "MARKER");
}

export function mcpSessionKey(sessionHash: string): DynamoDbItem {
  return key(`MCP_SESSION#${sessionHash}`, "SESSION");
}

export function rateLimitKey(bucketHash: string): DynamoDbItem {
  return key(`RATE#${bucketHash}`, "BUCKET");
}

export function metadataCacheKey(namespace: string, cacheKeyHash: string): DynamoDbItem {
  return key(`CACHE#${namespace}#${cacheKeyHash}`, "ENTRY");
}

export function key(pk: string, sk: string): DynamoDbItem {
  return { pk: stringAttr(pk), sk: stringAttr(sk) };
}

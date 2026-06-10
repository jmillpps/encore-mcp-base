import type { AuthorizationCodeExpectation, AuthorizationCodeInput, RefreshTokenInput, UpstreamAuthorizationStateInput } from "./store-inputs.ts";
import type { AuthorizationCodeRecord, McpSessionRecord, RefreshTokenRecord, UpstreamAuthorizationStateRecord } from "./store-records.ts";
import type { RateLimitPolicy } from "../../shared/config.ts";

export interface OAuthStore {
  createAuthorizationCode(input: AuthorizationCodeInput): Promise<string>;
  consumeAuthorizationCode(code: string, verifier: string | undefined, expected: AuthorizationCodeExpectation): Promise<AuthorizationCodeRecord>;
  createRefreshToken(input: RefreshTokenInput): Promise<string>;
  rotateRefreshToken(
    token: string,
    clientId: string,
    ttlSeconds: number,
    expectedResource?: string,
    allowedResources?: readonly string[],
  ): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }>;
  createUpstreamAuthorizationState(input: UpstreamAuthorizationStateInput): Promise<string>;
  consumeUpstreamAuthorizationState(state: string): Promise<UpstreamAuthorizationStateRecord>;
  saveMcpSession(record: McpSessionRecord): Promise<void>;
  touchMcpSession(sessionIdHash: string, protocolVersion: string | undefined, markInitialized?: boolean): Promise<{ initialized: boolean }>;
  reserveMcpRequestId(sessionIdHash: string, requestIdHash: string): Promise<boolean>;
  terminateMcpSession(sessionIdHash: string): Promise<void>;
}

export interface RateLimitStore {
  hit(key: string, policy: RateLimitPolicy): Promise<void>;
}

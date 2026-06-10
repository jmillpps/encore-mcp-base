import type { ServiceConfig } from "../../../shared/config.ts";
import type { AuthorizationCodeExpectation, AuthorizationCodeInput, RefreshTokenInput, UpstreamAuthorizationStateInput } from "../store-inputs.ts";
import type { AuthorizationCodeRecord, McpSessionRecord, RefreshTokenRecord, UpstreamAuthorizationStateRecord } from "../store-records.ts";
import type { OAuthStore } from "../oauth-store.ts";
import { createAuthorizationCode, consumeAuthorizationCode } from "./authorization-codes.ts";
import type { DynamoDbClient } from "./client.ts";
import { saveMcpSession, reserveMcpRequestId, terminateMcpSession, touchMcpSession } from "./mcp-sessions.ts";
import { createRefreshToken, rotateRefreshToken } from "./refresh-tokens.ts";
import { dynamoDbStoreContext } from "./store-context.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";
import { createUpstreamAuthorizationState, consumeUpstreamAuthorizationState } from "./upstream-states.ts";

export class DynamoDbOAuthStore implements OAuthStore {
  private readonly ctx: DynamoDbStoreContext;

  constructor(config: ServiceConfig, client: DynamoDbClient) {
    this.ctx = dynamoDbStoreContext(config, client);
  }

  createAuthorizationCode(input: AuthorizationCodeInput): Promise<string> {
    return createAuthorizationCode(this.ctx, input);
  }

  consumeAuthorizationCode(code: string, verifier: string | undefined, expected: AuthorizationCodeExpectation): Promise<AuthorizationCodeRecord> {
    return consumeAuthorizationCode(this.ctx, code, verifier, expected);
  }

  createRefreshToken(input: RefreshTokenInput): Promise<string> {
    return createRefreshToken(this.ctx, input);
  }

  rotateRefreshToken(
    token: string,
    clientId: string,
    ttlSeconds: number,
    expectedResource?: string,
    allowedResources?: readonly string[],
  ): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }> {
    return rotateRefreshToken(this.ctx, token, clientId, ttlSeconds, expectedResource, allowedResources);
  }

  createUpstreamAuthorizationState(input: UpstreamAuthorizationStateInput): Promise<string> {
    return createUpstreamAuthorizationState(this.ctx, input);
  }

  consumeUpstreamAuthorizationState(state: string): Promise<UpstreamAuthorizationStateRecord> {
    return consumeUpstreamAuthorizationState(this.ctx, state);
  }

  saveMcpSession(record: McpSessionRecord): Promise<void> {
    return saveMcpSession(this.ctx, record);
  }

  touchMcpSession(sessionIdHash: string, protocolVersion: string | undefined, markInitialized = false): Promise<{ initialized: boolean }> {
    return touchMcpSession(this.ctx, sessionIdHash, protocolVersion, markInitialized);
  }

  reserveMcpRequestId(sessionIdHash: string, requestIdHash: string): Promise<boolean> {
    return reserveMcpRequestId(this.ctx, sessionIdHash, requestIdHash);
  }

  terminateMcpSession(sessionIdHash: string): Promise<void> {
    return terminateMcpSession(this.ctx, sessionIdHash);
  }
}

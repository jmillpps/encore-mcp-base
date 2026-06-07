import { randomToken, s256Challenge, sha256Base64Url } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { pkceVerifier } from "../pkce.ts";
import { isExpired } from "./expiration.ts";
import { StoreFile } from "./store-file.ts";
import type { AuthorizationCodeExpectation, AuthorizationCodeInput, RefreshTokenInput } from "./store-inputs.ts";
import type { AuthorizationCodeRecord, McpSessionRecord, RefreshTokenRecord } from "./store-records.ts";

export class DiskOAuthStore {
  private readonly file: StoreFile;

  constructor(path: string) {
    this.file = new StoreFile(path);
  }

  async createAuthorizationCode(input: AuthorizationCodeInput): Promise<string> {
    const code = randomToken(32);
    const createdAt = nowSeconds();
    const record: AuthorizationCodeRecord = {
      codeHash: sha256Base64Url(code),
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      resource: input.resource,
      scopes: input.scopes,
      userSub: input.userSub,
      expiresAt: createdAt + input.ttlSeconds,
      authTime: createdAt,
      createdAt,
      ...(input.nonce ? { nonce: input.nonce } : {}),
      ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
      ...(input.codeChallengeMethod ? { codeChallengeMethod: input.codeChallengeMethod } : {}),
    };
    await this.file.update((state) => {
      state.authorizationCodes[record.codeHash] = record;
    });
    return code;
  }

  async consumeAuthorizationCode(code: string, verifier: string | undefined, expected: AuthorizationCodeExpectation): Promise<AuthorizationCodeRecord> {
    const hash = sha256Base64Url(code);
    return this.file.update((state) => {
      const record = state.authorizationCodes[hash];
      if (!record) throw new ServiceError("invalid_grant", "invalid grant", 400);
      const now = nowSeconds();
      if (record.consumedAt || isExpired(record.expiresAt, now)) throw new ServiceError("invalid_grant", "invalid grant", 400);
      if (record.clientId !== expected.clientId || record.redirectUri !== expected.redirectUri) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (expected.resource !== undefined && record.resource !== expected.resource) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (expected.allowedResources && !expected.allowedResources.includes(record.resource)) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (expected.allowedScopes && record.scopes.some((scope) => !expected.allowedScopes?.includes(scope))) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (record.codeChallenge) {
        const checkedVerifier = pkceVerifier(verifier);
        if (s256Challenge(checkedVerifier) !== record.codeChallenge) throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      record.consumedAt = now;
      return record;
    });
  }

  async createRefreshToken(input: RefreshTokenInput): Promise<string> {
    const token = randomToken(32);
    const createdAt = nowSeconds();
    const record: RefreshTokenRecord = {
      tokenHash: sha256Base64Url(token),
      familyId: randomToken(18),
      clientId: input.clientId,
      userSub: input.userSub,
      resource: input.resource,
      scopes: input.scopes,
      expiresAt: createdAt + input.ttlSeconds,
      authTime: input.authTime,
      createdAt,
    };
    await this.file.update((state) => {
      state.refreshTokens[record.tokenHash] = record;
    });
    return token;
  }

  async rotateRefreshToken(
    token: string,
    clientId: string,
    ttlSeconds: number,
    expectedResource?: string,
    allowedResources?: readonly string[],
  ): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }> {
    const oldHash = sha256Base64Url(token);
    const result = await this.file.update((state) => {
      const oldRecord = state.refreshTokens[oldHash];
      const now = nowSeconds();
      if (!oldRecord || oldRecord.revokedAt || isExpired(oldRecord.expiresAt, now)) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (oldRecord.clientId !== clientId) throw new ServiceError("invalid_grant", "invalid grant", 400);
      if (expectedResource !== undefined && oldRecord.resource !== expectedResource) throw new ServiceError("invalid_grant", "invalid grant", 400);
      if (allowedResources && !allowedResources.includes(oldRecord.resource)) throw new ServiceError("invalid_grant", "invalid grant", 400);
      if (Object.values(state.refreshTokens).some((record) => record.rotatedFromHash === oldHash)) {
        for (const record of Object.values(state.refreshTokens)) {
          if (record.familyId === oldRecord.familyId) record.revokedAt = now;
        }
        return { reused: true as const };
      }
      const newToken = randomToken(32);
      const newRecord: RefreshTokenRecord = {
        tokenHash: sha256Base64Url(newToken),
        familyId: oldRecord.familyId,
        clientId: oldRecord.clientId,
        userSub: oldRecord.userSub,
        resource: oldRecord.resource,
        scopes: oldRecord.scopes,
        expiresAt: now + ttlSeconds,
        authTime: oldRecord.authTime,
        rotatedFromHash: oldHash,
        createdAt: now,
      };
      oldRecord.lastUsedAt = now;
      state.refreshTokens[newRecord.tokenHash] = newRecord;
      return { reused: false as const, oldRecord, newToken };
    });
    if (result.reused) throw new ServiceError("invalid_grant", "invalid grant", 400);
    return { oldRecord: result.oldRecord, newToken: result.newToken };
  }

  async saveMcpSession(record: McpSessionRecord): Promise<void> {
    await this.file.update((state) => {
      state.mcpSessions[record.sessionIdHash] = record;
    });
  }

  async touchMcpSession(sessionIdHash: string, protocolVersion: string, markInitialized = false): Promise<{ initialized: boolean }> {
    return this.file.update((state) => {
      const record = state.mcpSessions[sessionIdHash];
      const now = nowSeconds();
      if (!record || record.terminatedAt || isExpired(record.expiresAt, now)) throw new ServiceError("not_found", "mcp session not found", 404);
      if (record.protocolVersion !== protocolVersion) throw new ServiceError("bad_request", "unsupported protocol version", 400);
      record.lastSeenAt = now;
      if (markInitialized && !record.initializedAt) record.initializedAt = now;
      return { initialized: record.initializedAt !== undefined };
    });
  }

  async terminateMcpSession(sessionIdHash: string): Promise<void> {
    await this.file.update((state) => {
      const record = state.mcpSessions[sessionIdHash];
      const now = nowSeconds();
      if (!record || record.terminatedAt || isExpired(record.expiresAt, now)) throw new ServiceError("not_found", "mcp session not found", 404);
      record.terminatedAt = now;
      record.lastSeenAt = now;
    });
  }
}

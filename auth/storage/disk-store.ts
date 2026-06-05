import { randomToken, s256Challenge, sha256Base64Url } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { StoreFile } from "./store-file.ts";
import type { AuthorizationCodeRecord, McpSessionRecord, RefreshTokenRecord } from "./store-records.ts";

export interface AuthorizationCodeInput {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  userSub: string;
  ttlSeconds: number;
}

export interface RefreshTokenInput {
  clientId: string;
  userSub: string;
  resource: string;
  scopes: string[];
  ttlSeconds: number;
}

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
      createdAt,
      ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
      ...(input.codeChallengeMethod ? { codeChallengeMethod: input.codeChallengeMethod } : {}),
    };
    await this.file.update((state) => {
      state.authorizationCodes[record.codeHash] = record;
    });
    return code;
  }

  async consumeAuthorizationCode(code: string, verifier: string | undefined): Promise<AuthorizationCodeRecord> {
    const hash = sha256Base64Url(code);
    return this.file.update((state) => {
      const record = state.authorizationCodes[hash];
      if (!record) throw new ServiceError("invalid_grant", "invalid grant", 400);
      const now = nowSeconds();
      if (record.consumedAt || record.expiresAt < now) throw new ServiceError("invalid_grant", "invalid grant", 400);
      if (record.codeChallenge && s256Challenge(verifier ?? "") !== record.codeChallenge) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
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
      createdAt,
    };
    await this.file.update((state) => {
      state.refreshTokens[record.tokenHash] = record;
    });
    return token;
  }

  async rotateRefreshToken(token: string, ttlSeconds: number): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }> {
    const oldHash = sha256Base64Url(token);
    return this.file.update((state) => {
      const oldRecord = state.refreshTokens[oldHash];
      const now = nowSeconds();
      if (!oldRecord || oldRecord.revokedAt || oldRecord.expiresAt < now) {
        throw new ServiceError("invalid_grant", "invalid grant", 400);
      }
      if (oldRecord.rotatedToHash) {
        for (const record of Object.values(state.refreshTokens)) {
          if (record.familyId === oldRecord.familyId) record.revokedAt = now;
        }
        throw new ServiceError("invalid_grant", "invalid grant", 400);
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
        createdAt: now,
      };
      oldRecord.rotatedToHash = newRecord.tokenHash;
      oldRecord.lastUsedAt = now;
      state.refreshTokens[newRecord.tokenHash] = newRecord;
      return { oldRecord, newToken };
    });
  }

  async saveMcpSession(record: McpSessionRecord): Promise<void> {
    await this.file.update((state) => {
      state.mcpSessions[record.sessionIdHash] = record;
    });
  }
}

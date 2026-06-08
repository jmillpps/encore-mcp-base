import type { UserProfile } from "../user-profile.ts";

export interface AuthorizationCodeRecord {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  user: UserProfile;
  expiresAt: number;
  consumedAt?: number;
  authTime: number;
  createdAt: number;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  familyId: string;
  clientId: string;
  user: UserProfile;
  resource: string;
  scopes: string[];
  expiresAt: number;
  authTime: number;
  rotatedFromHash?: string;
  revokedAt?: number;
  createdAt: number;
  lastUsedAt?: number;
}

export interface UpstreamAuthorizationStateRecord {
  stateHash: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  clientState: string;
  codeVerifier: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  expiresAt: number;
  createdAt: number;
}

export interface McpSessionRecord {
  sessionIdHash: string;
  clientId: string;
  protocolVersion: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  requestIdHashes: string[];
  initializedAt?: number;
  terminatedAt?: number;
}

export interface OAuthStoreState {
  authorizationCodes: Record<string, AuthorizationCodeRecord>;
  refreshTokens: Record<string, RefreshTokenRecord>;
  upstreamAuthorizationStates: Record<string, UpstreamAuthorizationStateRecord>;
  mcpSessions: Record<string, McpSessionRecord>;
  rateLimits: Record<string, { count: number; resetAt: number }>;
}

export function emptyStoreState(): OAuthStoreState {
  return {
    authorizationCodes: {},
    refreshTokens: {},
    upstreamAuthorizationStates: {},
    mcpSessions: {},
    rateLimits: {},
  };
}

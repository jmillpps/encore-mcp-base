export interface AuthorizationCodeRecord {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  userSub: string;
  expiresAt: number;
  consumedAt?: number;
  createdAt: number;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  familyId: string;
  clientId: string;
  userSub: string;
  resource: string;
  scopes: string[];
  expiresAt: number;
  rotatedFromHash?: string;
  rotatedToHash?: string;
  revokedAt?: number;
  createdAt: number;
  lastUsedAt?: number;
}

export interface McpSessionRecord {
  sessionIdHash: string;
  clientId: string;
  protocolVersion: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  terminatedAt?: number;
}

export interface OAuthStoreState {
  authorizationCodes: Record<string, AuthorizationCodeRecord>;
  refreshTokens: Record<string, RefreshTokenRecord>;
  mcpSessions: Record<string, McpSessionRecord>;
  rateLimits: Record<string, { count: number; resetAt: number }>;
}

export function emptyStoreState(): OAuthStoreState {
  return {
    authorizationCodes: {},
    refreshTokens: {},
    mcpSessions: {},
    rateLimits: {},
  };
}

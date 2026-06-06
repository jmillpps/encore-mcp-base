export interface AuthorizationCodeInput {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  userSub: string;
  ttlSeconds: number;
}

export interface AuthorizationCodeExpectation {
  clientId: string;
  redirectUri: string;
  resource?: string;
  allowedResources?: readonly string[];
  allowedScopes?: readonly string[];
}

export interface RefreshTokenInput {
  clientId: string;
  userSub: string;
  resource: string;
  scopes: string[];
  authTime: number;
  ttlSeconds: number;
}

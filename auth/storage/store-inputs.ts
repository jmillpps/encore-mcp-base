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

export interface AuthorizationCodeExpectation {
  clientId: string;
  redirectUri: string;
  resource?: string;
}

export interface RefreshTokenInput {
  clientId: string;
  userSub: string;
  resource: string;
  scopes: string[];
  ttlSeconds: number;
}

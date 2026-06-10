import type { UserProfile } from "../user-profile.ts";

export interface AuthorizationCodeInput {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  user: UserProfile;
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
  user: UserProfile;
  resource: string;
  scopes: string[];
  authTime: number;
  ttlSeconds: number;
}

export interface UpstreamAuthorizationStateInput {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  clientState: string;
  codeVerifier: string;
  upstreamNonce: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
  ttlSeconds: number;
}

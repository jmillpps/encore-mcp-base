export type UpstreamOidcTokenAuthMethod = "client_secret_post" | "client_secret_basic";

export interface UpstreamOidcConfig {
  issuer: string;
  discoveryUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenEndpointAuthMethod: UpstreamOidcTokenAuthMethod;
}

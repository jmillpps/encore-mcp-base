export type TokenEndpointAuthMethod = "client_secret_post" | "client_secret_basic" | "none" | "private_key_jwt";
export type PkcePolicy = "required" | "optional";

export interface OAuthClient {
  clientId: string;
  clientSecretHash?: string;
  displayName: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedResources: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  jwksUri?: string;
  pkcePolicy: PkcePolicy;
  clientClass: string;
}

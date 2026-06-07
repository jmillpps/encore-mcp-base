export type TokenEndpointAuthMethod = "client_secret_post" | "client_secret_basic" | "none";
export type PkcePolicy = "required" | "optional";

export interface OAuthClient {
  clientId: string;
  clientSecretHash?: string;
  displayName: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedResources: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  pkcePolicy: PkcePolicy;
  clientClass: string;
}

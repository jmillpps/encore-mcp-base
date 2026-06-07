export type ToolSecurityScheme = NoAuthSecurityScheme | OAuthSecurityScheme;

interface NoAuthSecurityScheme {
  type: "noauth";
}

interface OAuthSecurityScheme {
  type: "oauth2";
  scopes: string[];
}

export function toolSecuritySchemes(scopes: readonly string[]): ToolSecurityScheme[] {
  if (scopes.length === 0) return [{ type: "noauth" }];
  return [{ type: "oauth2", scopes: [...scopes] }];
}

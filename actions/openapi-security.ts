export interface OAuthSecurityMetadata {
  type: "oauth2";
  authorizationUrl: string;
  tokenUrl: string;
  scopes: Record<string, string>;
}

export function actionOAuthSecurity(baseUrl: string): OAuthSecurityMetadata {
  return {
    type: "oauth2",
    authorizationUrl: `${baseUrl}/oauth/authorize`,
    tokenUrl: `${baseUrl}/oauth/token`,
    scopes: {
      openid: "Identify the signed-in user.",
      profile: "Read the user profile.",
      email: "Read the user email address.",
    },
  };
}

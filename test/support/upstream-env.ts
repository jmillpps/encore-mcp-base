export function productionUpstreamOidcEnv(): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: "https://idp.example.test",
    UPSTREAM_OIDC_AUTHORIZATION_URL: "https://login.example.test/oauth2/authorize",
    UPSTREAM_OIDC_TOKEN_URL: "https://login.example.test/oauth2/token",
    UPSTREAM_OIDC_USERINFO_URL: "https://login.example.test/oauth2/userInfo",
    UPSTREAM_OIDC_CLIENT_ID: "upstream-client",
    UPSTREAM_OIDC_CLIENT_SECRET: "upstream-secret",
    UPSTREAM_OIDC_REDIRECT_URI: "https://issuer.example.test/oauth/callback",
    UPSTREAM_OIDC_SCOPES: "openid profile email",
    UPSTREAM_OIDC_TOKEN_AUTH_METHOD: "client_secret_post",
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../../shared/config.ts";

test("production config requires explicit secure public URLs and origins", () => {
  const config = readConfig(productionEnv());
  assert.equal(config.production, true);
  assert.equal(config.issuer, "https://issuer.example.test");
  assert.equal(config.mcpResource, "https://mcp.example.test/mcp");
  assert.equal(config.actionsAudience, "https://api.example.test/actions");
  assert.equal(config.widgetDomain, "https://widgets.example.test");
  assert.equal(config.oauthStoreBackend, "dynamodb");
  assert.equal(config.oauthDynamoDb.tableName, "operator-mcp-state");
  assert.equal(config.oauthDynamoDb.region, "us-east-1");
  assert.deepEqual(config.allowedOrigins, ["https://chatgpt.com"]);
  assert.equal(config.accessTokenTtlSeconds, 900);
  assert.equal(config.idTokenTtlSeconds, 300);
  assert.equal(config.authorizationCodeTtlSeconds, 300);
  assert.equal(config.refreshTokenTtlSeconds, 2592000);
  assert.equal(config.rateLimitWindowSeconds, 60);
  assert.equal(config.rateLimitMaxRequests, 120);
  assert.equal(config.mcpListPageSize, 128);
  assert.equal(config.mcpSseMaxConnections, 1024);
  assert.equal(config.upstreamOidc.issuer, "https://idp.example.test");
});

test("production config accepts explicit upstream OIDC provider settings", () => {
  const config = readConfig(productionEnv(upstreamOidcEnv()));
  assert.equal(config.upstreamOidc.issuer, "https://idp-alt.example.test");
  assert.equal(config.upstreamOidc.authorizationUrl, "https://login-alt.example.test/oauth2/authorize");
  assert.equal(config.upstreamOidc.tokenUrl, "https://login-alt.example.test/oauth2/token");
  assert.equal(config.upstreamOidc.userinfoUrl, "https://login-alt.example.test/oauth2/userInfo");
  assert.equal(config.upstreamOidc.clientId, "upstream-client-alt");
  assert.equal(config.upstreamOidc.clientSecret, "upstream-secret-alt");
  assert.equal(config.upstreamOidc.redirectUri, "https://issuer.example.test/oauth/callback");
  assert.deepEqual(config.upstreamOidc.scopes, ["openid", "profile", "email", "custom:read"]);
  assert.equal(config.upstreamOidc.tokenEndpointAuthMethod, "client_secret_basic");
});

test("production config rejects insecure or ambiguous deployment inputs", () => {
  assert.throws(() => readConfig(productionEnv({ PUBLIC_ISSUER_URL: "http://issuer.example.test" })), /https/);
  assert.throws(() => readConfig(productionEnv({ PUBLIC_ISSUER_URL: "https://localhost" })), /public host/);
  assert.throws(() => readConfig(productionEnv({ PUBLIC_ISSUER_URL: "https://issuer.example.test?debug=true" })), /unsupported URL parts/);
  assert.throws(() => readConfig(productionEnv({ PUBLIC_ISSUER_URL: "https://issuer.example.test/tenant" })), /must not include a path/);
  assert.throws(() => readConfig(productionEnv({ MCP_RESOURCE_URL: "" })), /MCP_RESOURCE_URL is required/);
  assert.throws(() => readConfig(productionEnv({ MCP_RESOURCE_URL: "https://mcp.example.test" })), /MCP_RESOURCE_URL must end with \/mcp/);
  assert.throws(() => readConfig(productionEnv({ MCP_RESOURCE_URL: "https://127.0.0.1/mcp" })), /public host/);
  assert.throws(() => readConfig(productionEnv({ ACTIONS_AUDIENCE: "ftp://api.example.test/actions" })), /http or https/);
  assert.throws(() => readConfig(productionEnv({ ACTIONS_AUDIENCE: "https://user:pass@api.example.test/actions" })), /unsupported URL parts/);
  assert.throws(() => readConfig(productionEnv({ ACTIONS_AUDIENCE: "https://10.0.0.1/actions" })), /public host/);
  assert.throws(() => readConfig(productionEnv({ WIDGET_DOMAIN: "" })), /WIDGET_DOMAIN is required/);
  assert.throws(() => readConfig(productionEnv({ WIDGET_DOMAIN: "https://widgets.example.test/path" })), /WIDGET_DOMAIN must be an origin/);
  assert.throws(() => readConfig(productionEnv({ WIDGET_DOMAIN: "https://localhost" })), /public host/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://*.example.test" })), /wildcards/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://chatgpt.com/path" })), /must be origins/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://localhost" })), /public hosts/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_STORE_BACKEND: "file" })), /OAUTH_STORE_BACKEND must be dynamodb in production/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_STORE_PATH: "/tmp/oauth-store.json" })), /OAUTH_STORE_PATH requires file store backend/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_DYNAMODB_TABLE_NAME: "" })), /OAUTH_DYNAMODB_TABLE_NAME is required/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_DYNAMODB_TABLE_NAME: "bad table" })), /OAUTH_DYNAMODB_TABLE_NAME contains invalid characters/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_DYNAMODB_REGION: "" })), /OAUTH_DYNAMODB_REGION is required/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_DYNAMODB_REGION: "bad-region" })), /OAUTH_DYNAMODB_REGION contains invalid characters/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_DYNAMODB_ENDPOINT: "https://localhost:8000" })), /OAUTH_DYNAMODB_ENDPOINT is local-development only/);
  assert.throws(() => readConfig(productionEnv({ ACCESS_TOKEN_TTL_SECONDS: undefined })), /ACCESS_TOKEN_TTL_SECONDS is required/);
  assert.throws(() => readConfig(productionEnv({ RATE_LIMIT_MAX_REQUESTS: "0" })), /RATE_LIMIT_MAX_REQUESTS must be a positive safe integer/);
  assert.throws(() => readConfig(productionEnv({ MCP_LIST_PAGE_SIZE: undefined })), /MCP_LIST_PAGE_SIZE is required/);
  assert.throws(() => readConfig(productionEnv({ MCP_LIST_PAGE_SIZE: "257" })), /MCP_LIST_PAGE_SIZE must be at most 256/);
  assert.throws(() => readConfig(productionEnv({ MCP_SSE_MAX_CONNECTIONS: undefined })), /MCP_SSE_MAX_CONNECTIONS is required/);
  assert.throws(() => readConfig(productionEnv({ UPSTREAM_OIDC_TOKEN_URL: "http://auth.example.test/oauth2/token" })), /https/);
  assert.throws(() => readConfig(productionEnv({ UPSTREAM_OIDC_CLIENT_SECRET: "" })), /UPSTREAM_OIDC_CLIENT_SECRET is required/);
  assert.throws(() => readConfig(productionEnv({ UPSTREAM_OIDC_SCOPES: "profile email" })), /UPSTREAM_OIDC_SCOPES must include openid/);
  assert.throws(() => readConfig(productionEnv({ UPSTREAM_OIDC_TOKEN_AUTH_METHOD: "private_key_jwt" })), /UPSTREAM_OIDC_TOKEN_AUTH_METHOD/);
});

test("local config keeps localhost defaults for development", () => {
  const config = readConfig({});
  assert.equal(config.issuer, "http://localhost:4000");
  assert.equal(config.mcpResource, "http://localhost:4000/mcp");
  assert.equal(config.actionsAudience, "http://localhost:4000/actions");
  assert.equal(config.widgetDomain, "http://localhost:4000");
  assert.equal(config.oauthStoreBackend, "file");
  assert.ok(config.allowedOrigins.includes("http://localhost:4000"));
  assert.equal(config.mcpListPageSize, 128);
  assert.equal(config.upstreamOidc.redirectUri, "http://localhost:4000/oauth/callback");
});

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    PUBLIC_ISSUER_URL: "https://issuer.example.test",
    MCP_RESOURCE_URL: "https://mcp.example.test/mcp",
    ACTIONS_AUDIENCE: "https://api.example.test/actions",
    WIDGET_DOMAIN: "https://widgets.example.test",
    OAUTH_STORE_BACKEND: "dynamodb",
    OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state",
    OAUTH_DYNAMODB_REGION: "us-east-1",
    ALLOWED_ORIGINS: "https://chatgpt.com",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    ID_TOKEN_TTL_SECONDS: "300",
    AUTHORIZATION_CODE_TTL_SECONDS: "300",
    REFRESH_TOKEN_TTL_SECONDS: "2592000",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "120",
    MCP_LIST_PAGE_SIZE: "128",
    MCP_SSE_MAX_CONNECTIONS: "1024",
    ...defaultUpstreamOidcEnv(),
    ...overrides,
  };
}

function defaultUpstreamOidcEnv(): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: "https://idp.example.test",
    UPSTREAM_OIDC_DISCOVERY_URL: "https://idp.example.test/.well-known/openid-configuration",
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

function upstreamOidcEnv(): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: "https://idp-alt.example.test",
    UPSTREAM_OIDC_DISCOVERY_URL: "https://idp-alt.example.test/.well-known/openid-configuration",
    UPSTREAM_OIDC_AUTHORIZATION_URL: "https://login-alt.example.test/oauth2/authorize",
    UPSTREAM_OIDC_TOKEN_URL: "https://login-alt.example.test/oauth2/token",
    UPSTREAM_OIDC_USERINFO_URL: "https://login-alt.example.test/oauth2/userInfo",
    UPSTREAM_OIDC_CLIENT_ID: "upstream-client-alt",
    UPSTREAM_OIDC_CLIENT_SECRET: "upstream-secret-alt",
    UPSTREAM_OIDC_REDIRECT_URI: "https://issuer.example.test/oauth/callback",
    UPSTREAM_OIDC_SCOPES: "openid profile email custom:read",
    UPSTREAM_OIDC_TOKEN_AUTH_METHOD: "client_secret_basic",
  };
}

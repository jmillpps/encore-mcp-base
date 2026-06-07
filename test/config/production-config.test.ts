import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../../shared/config.ts";

test("production config requires explicit secure public URLs and origins", () => {
  const config = readConfig(productionEnv());
  assert.equal(config.production, true);
  assert.equal(config.issuer, "https://issuer.example.test");
  assert.equal(config.mcpResource, "https://mcp.example.test/mcp");
  assert.equal(config.actionsAudience, "https://api.example.test/actions");
  assert.deepEqual(config.allowedOrigins, ["https://chatgpt.com"]);
  assert.equal(config.accessTokenTtlSeconds, 900);
  assert.equal(config.idTokenTtlSeconds, 300);
  assert.equal(config.authorizationCodeTtlSeconds, 300);
  assert.equal(config.refreshTokenTtlSeconds, 2592000);
  assert.equal(config.rateLimitWindowSeconds, 60);
  assert.equal(config.rateLimitMaxRequests, 120);
  assert.equal(config.mcpSseMaxConnections, 1024);
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
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://*.example.test" })), /wildcards/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://chatgpt.com/path" })), /must be origins/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://localhost" })), /public hosts/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_STORE_PATH: "" })), /OAUTH_STORE_PATH is required/);
  assert.throws(() => readConfig(productionEnv({ ACCESS_TOKEN_TTL_SECONDS: undefined })), /ACCESS_TOKEN_TTL_SECONDS is required/);
  assert.throws(() => readConfig(productionEnv({ RATE_LIMIT_MAX_REQUESTS: "0" })), /RATE_LIMIT_MAX_REQUESTS must be a positive safe integer/);
  assert.throws(() => readConfig(productionEnv({ MCP_SSE_MAX_CONNECTIONS: undefined })), /MCP_SSE_MAX_CONNECTIONS is required/);
});

test("local config keeps localhost defaults for development", () => {
  const config = readConfig({});
  assert.equal(config.issuer, "http://localhost:4000");
  assert.equal(config.mcpResource, "http://localhost:4000/mcp");
  assert.equal(config.actionsAudience, "http://localhost:4000/actions");
  assert.ok(config.allowedOrigins.includes("http://localhost:4000"));
});

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    PUBLIC_ISSUER_URL: "https://issuer.example.test",
    MCP_RESOURCE_URL: "https://mcp.example.test/mcp",
    ACTIONS_AUDIENCE: "https://api.example.test/actions",
    OAUTH_STORE_PATH: "/tmp/oauth-store.json",
    ALLOWED_ORIGINS: "https://chatgpt.com",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    ID_TOKEN_TTL_SECONDS: "300",
    AUTHORIZATION_CODE_TTL_SECONDS: "300",
    REFRESH_TOKEN_TTL_SECONDS: "2592000",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "120",
    MCP_SSE_MAX_CONNECTIONS: "1024",
    ...overrides,
  };
}

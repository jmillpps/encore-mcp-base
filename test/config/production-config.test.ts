import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../../shared/config.ts";

test("production config requires explicit secure public URLs and origins", () => {
  const config = readConfig(productionEnv());
  assert.equal(config.production, true);
  assert.equal(config.issuer, "https://issuer.example.test");
  assert.equal(config.mcpResource, "https://mcp.example.test");
  assert.equal(config.actionsAudience, "https://api.example.test/actions");
  assert.deepEqual(config.allowedOrigins, ["https://chatgpt.com"]);
  assert.equal(config.accessTokenTtlSeconds, 900);
  assert.equal(config.idTokenTtlSeconds, 300);
  assert.equal(config.authorizationCodeTtlSeconds, 300);
  assert.equal(config.refreshTokenTtlSeconds, 2592000);
  assert.equal(config.rateLimitWindowSeconds, 60);
  assert.equal(config.rateLimitMaxRequests, 120);
});

test("production config rejects insecure or ambiguous deployment inputs", () => {
  assert.throws(() => readConfig(productionEnv({ PUBLIC_ISSUER_URL: "http://issuer.example.test" })), /https/);
  assert.throws(() => readConfig(productionEnv({ MCP_RESOURCE_URL: "" })), /MCP_RESOURCE_URL is required/);
  assert.throws(() => readConfig(productionEnv({ ACTIONS_AUDIENCE: "ftp://api.example.test/actions" })), /http or https/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://*.example.test" })), /wildcards/);
  assert.throws(() => readConfig(productionEnv({ ALLOWED_ORIGINS: "https://chatgpt.com/path" })), /must be origins/);
  assert.throws(() => readConfig(productionEnv({ OAUTH_STORE_PATH: "" })), /OAUTH_STORE_PATH is required/);
  assert.throws(() => readConfig(productionEnv({ ACCESS_TOKEN_TTL_SECONDS: undefined })), /ACCESS_TOKEN_TTL_SECONDS is required/);
  assert.throws(() => readConfig(productionEnv({ RATE_LIMIT_MAX_REQUESTS: "0" })), /RATE_LIMIT_MAX_REQUESTS must be a positive safe integer/);
});

test("local config keeps localhost defaults for development", () => {
  const config = readConfig({});
  assert.equal(config.issuer, "http://localhost:4000");
  assert.equal(config.mcpResource, "http://localhost:4000");
  assert.equal(config.actionsAudience, "http://localhost:4000/actions");
  assert.ok(config.allowedOrigins.includes("http://localhost:4000"));
});

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    PUBLIC_ISSUER_URL: "https://issuer.example.test",
    MCP_RESOURCE_URL: "https://mcp.example.test",
    ACTIONS_AUDIENCE: "https://api.example.test/actions",
    OAUTH_STORE_PATH: "/tmp/oauth-store.json",
    ALLOWED_ORIGINS: "https://chatgpt.com",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    ID_TOKEN_TTL_SECONDS: "300",
    AUTHORIZATION_CODE_TTL_SECONDS: "300",
    REFRESH_TOKEN_TTL_SECONDS: "2592000",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "120",
    ...overrides,
  };
}

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { validateStartup } from "../../auth/startup.ts";
import { sha256Base64Url } from "../../shared/crypto.ts";
import { expectServiceStartupFailure } from "../support/service-process.ts";
import { testStaticUserEnv } from "../support/static-user.ts";

test("startup validation accepts complete production OAuth configuration", () => {
  assert.doesNotThrow(() => validateStartup(productionEnv({ OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-1" })));
  assert.doesNotThrow(() =>
    validateStartup(productionEnv({ ...cognitoEnv(), ...withoutStaticUser(), OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-1" })),
  );
});

test("startup validation rejects incomplete production OAuth configuration", () => {
  assert.throws(() => validateStartup(productionEnv({ OAUTH_CLIENTS_JSON: "" })), /OAUTH_CLIENTS_JSON is required/);
  assert.throws(() => validateStartup(productionEnv({ OAUTH_PRIVATE_KEY_PEM: "" })), /OAUTH_PRIVATE_KEY_PEM is required/);
  assert.throws(() => validateStartup(productionEnv({ OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "" })), /OAUTH_KEY_ID is required/);
  assert.throws(() => validateStartup(productionEnv({ OAUTH_STORE_PATH: " oauth-store.json" })), /store path cannot include surrounding whitespace/);
  assert.throws(() => validateStartup(productionEnv({ OAUTH_STORE_PATH: "oauth-store.txt" })), /store path must end with .json/);
  assert.throws(() => validateStartup(productionEnv({ OAUTH_STORE_PATH: "../oauth-store.json" })), /store path cannot traverse upward/);
  assert.throws(() => validateStartup(productionEnv({ STATIC_USER_EMAIL: "" })), /STATIC_USER_EMAIL is required/);
  assert.throws(() => validateStartup(productionEnv({ STATIC_USER_EMAIL_VERIFIED: "" })), /STATIC_USER_EMAIL_VERIFIED is required/);
  assert.throws(() => validateStartup(productionEnv({ ...cognitoEnv(), COGNITO_CLIENT_SECRET: "" })), /COGNITO_CLIENT_SECRET is required/);
});

test("Encore production startup fails closed when signing key material is missing", async (t) => {
  const output = await expectServiceStartupFailure(t, productionEnv({ OAUTH_PRIVATE_KEY_PEM: "" }));
  assert.match(output, /OAUTH_PRIVATE_KEY_PEM is required/);
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
    OAUTH_CLIENTS_JSON: JSON.stringify([clientRecord()]),
    ...testStaticUserEnv,
    ...overrides,
  };
}

function clientRecord(): Record<string, unknown> {
  return {
    clientId: "actions-client",
    clientSecretHash: sha256Base64Url("actions-secret"),
    displayName: "GPT Actions",
    redirectUris: ["https://chatgpt.com/aip/g-prod/oauth/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: ["https://api.example.test/actions"],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "optional",
    clientClass: "gpt-actions",
  };
}

function privateKeyPem(): string {
  return generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function cognitoEnv(): NodeJS.ProcessEnv {
  return {
    COGNITO_ENABLED: "true",
    COGNITO_ISSUER_URL: "https://cognito-idp.example.test/pool",
    COGNITO_AUTHORIZATION_URL: "https://auth.example.test/oauth2/authorize",
    COGNITO_TOKEN_URL: "https://auth.example.test/oauth2/token",
    COGNITO_USERINFO_URL: "https://auth.example.test/oauth2/userInfo",
    COGNITO_CLIENT_ID: "cognito-client",
    COGNITO_CLIENT_SECRET: "cognito-secret",
    COGNITO_REDIRECT_URI: "https://issuer.example.test/oauth/cognito/callback",
    COGNITO_SCOPES: "openid profile email",
  };
}

function withoutStaticUser(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.keys(testStaticUserEnv).map((key) => [key, undefined]));
}

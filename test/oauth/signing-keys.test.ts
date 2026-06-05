import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { getSigningKey } from "../../auth/tokens/signing-keys.ts";
import { readConfig } from "../../shared/config.ts";

test("production signing key lookup fails closed without configured key material", () => {
  getSigningKey(readConfig({}), {});
  assert.throws(() => getSigningKey(productionConfig(), {}), /OAUTH_PRIVATE_KEY_PEM is required/);
});

test("configured production signing keys are isolated by source and key id", () => {
  const config = productionConfig();
  const first = getSigningKey(config, { OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-1" });
  const second = getSigningKey(config, { OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-2" });
  assert.equal(first.kid, "prod-key-1");
  assert.equal(second.kid, "prod-key-2");
  assert.notEqual(first.publicKey.export({ format: "jwk" }).n, second.publicKey.export({ format: "jwk" }).n);
});

function productionConfig() {
  return readConfig({
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
  });
}

function privateKeyPem(): string {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

import assert from "node:assert/strict";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import test from "node:test";
import { verifyAccessToken } from "../../auth/tokens/access-token.ts";
import { jwks } from "../../auth/tokens/jwks.ts";
import { getSigningKey } from "../../auth/tokens/signing-keys.ts";
import { signJwt } from "../../auth/tokens/jwt.ts";
import { readConfig } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";

test("production signing key lookup fails closed without configured key material", () => {
  getSigningKey(readConfig({}), {});
  assert.throws(() => getSigningKey(productionConfig(), {}), /OAUTH_PRIVATE_KEY_PEM is required/);
});

test("production signing key lookup requires an explicit key id", () => {
  assert.throws(() => getSigningKey(productionConfig(), { OAUTH_PRIVATE_KEY_PEM: privateKeyPem() }), /OAUTH_KEY_ID is required/);
});

test("configured production signing keys are isolated by source and key id", () => {
  const config = productionConfig();
  const first = getSigningKey(config, { OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-1" });
  const second = getSigningKey(config, { OAUTH_PRIVATE_KEY_PEM: privateKeyPem(), OAUTH_KEY_ID: "prod-key-2" });
  assert.equal(first.kid, "prod-key-1");
  assert.equal(second.kid, "prod-key-2");
  assert.notEqual(first.publicKey.export({ format: "jwk" }).n, second.publicKey.export({ format: "jwk" }).n);
});

test("previous production public keys verify old access tokens and publish in JWKS", () => {
  const config = productionConfig();
  const active = keyPair();
  const previous = keyPair();
  const env = {
    OAUTH_PRIVATE_KEY_PEM: privateKeyPem(active),
    OAUTH_KEY_ID: "active-key",
    OAUTH_PREVIOUS_PUBLIC_KEYS_JSON: JSON.stringify([{ kid: "previous-key", publicKeyPem: publicKeyPem(previous) }]),
  };
  withEnv(env, () => {
    const token = signJwt(accessClaims(config, "previous-key"), "previous-key", previous.privateKey);
    const claims = verifyAccessToken(config, token, config.actionsAudience);
    assert.equal(claims.client_id, "local-test");
    const keyIds = jwks(config).keys.map((key) => key.kid);
    assert.deepEqual(keyIds.sort(), ["active-key", "previous-key"]);
  });
});

test("production signing key ids must be unique across active and previous keys", () => {
  const previous = keyPair();
  assert.throws(
    () =>
      getSigningKey(productionConfig(), {
        OAUTH_PRIVATE_KEY_PEM: privateKeyPem(),
        OAUTH_KEY_ID: "duplicate-key",
        OAUTH_PREVIOUS_PUBLIC_KEYS_JSON: JSON.stringify([{ kid: "duplicate-key", publicKeyPem: publicKeyPem(previous) }]),
      }),
    /signing key ids must be unique/,
  );
});

test("production signing key ids reject unsafe characters", () => {
  const previous = keyPair();
  assert.throws(
    () =>
      getSigningKey(productionConfig(), {
        OAUTH_PRIVATE_KEY_PEM: privateKeyPem(),
        OAUTH_KEY_ID: "bad key",
      }),
    /safe key id characters/,
  );
  assert.throws(
    () =>
      getSigningKey(productionConfig(), {
        OAUTH_PRIVATE_KEY_PEM: privateKeyPem(),
        OAUTH_KEY_ID: "active-key",
        OAUTH_PREVIOUS_PUBLIC_KEYS_JSON: JSON.stringify([{ kid: "bad key", publicKeyPem: publicKeyPem(previous) }]),
      }),
    /safe key id characters/,
  );
});

function productionConfig() {
  return readConfig({
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
  });
}

function accessClaims(config: ReturnType<typeof productionConfig>, kid: string): Record<string, unknown> {
  const now = nowSeconds();
  return { iss: config.issuer, sub: "user_justin_miller", aud: config.actionsAudience, exp: now + 900, iat: now, nbf: now, jti: kid, client_id: "local-test", scope: "openid profile email" };
}

interface TestKeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
}

function keyPair(): TestKeyPair {
  return generateKeyPairSync("rsa", { modulusLength: 2048 }) as TestKeyPair;
}

function privateKeyPem(pair = keyPair()): string {
  return pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function publicKeyPem(pair: TestKeyPair): string {
  return pair.publicKey.export({ type: "spki", format: "pem" }).toString();
}

function withEnv(env: NodeJS.ProcessEnv, fn: () => void): void {
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, env);
    fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

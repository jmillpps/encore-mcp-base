import assert from "node:assert/strict";
import test from "node:test";
import { ServiceError } from "../../shared/errors.ts";
import { readConfig, type ServiceConfig } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";
import { getSigningKey } from "../../auth/tokens/signing-keys.ts";
import { signJwt } from "../../auth/tokens/jwt.ts";
import { verifyAccessToken } from "../../auth/tokens/access-token.ts";

test("access token verifier rejects future issued-at values", () => {
  const config = testConfig();
  assertRejectsToken(config, { iat: nowSeconds() + 60 });
});

test("access token verifier rejects non-integer NumericDate values", () => {
  const config = testConfig();
  assertRejectsToken(config, { exp: nowSeconds() + 900.5 });
  assertRejectsToken(config, { nbf: 0.5 });
});

test("access token verifier rejects empty string claims", () => {
  const config = testConfig();
  assertRejectsToken(config, { sub: "" });
  assertRejectsToken(config, { client_id: " " });
  assertRejectsToken(config, { jti: "" });
});

test("access token verifier rejects malformed scope strings", () => {
  const config = testConfig();
  assertRejectsToken(config, { scope: "" });
  assertRejectsToken(config, { scope: "openid\nprofile" });
  assertRejectsToken(config, { scope: "openid profile " });
  assertRejectsToken(config, { scope: "openid bad!scope" });
});

test("access token verifier rejects malformed JWT input as unauthorized", () => {
  const config = testConfig();
  assertRejectsRawToken(config, "not-a-jwt");
  assertRejectsRawToken(config, "aaa.bbb.ccc");
  assertRejectsRawToken(config, `${signedAccessToken(config, {}).split(".").slice(0, 2).join(".")}.%%%`);
});

function assertRejectsToken(config: ServiceConfig, overrides: Record<string, unknown>): void {
  assertRejectsRawToken(config, signedAccessToken(config, overrides));
}

function assertRejectsRawToken(config: ServiceConfig, token: string): void {
  assert.throws(
    () => verifyAccessToken(config, token, config.actionsAudience),
    (error) => error instanceof ServiceError && error.code === "unauthorized",
  );
}

function signedAccessToken(config: ServiceConfig, overrides: Record<string, unknown>): string {
  const now = nowSeconds();
  const key = getSigningKey(config);
  return signJwt(
    {
      iss: config.issuer,
      sub: "user_justin_miller",
      aud: config.actionsAudience,
      exp: now + 900,
      iat: now,
      nbf: now,
      jti: "token-claim-test",
      client_id: "local-test",
      scope: "openid profile email",
      ...overrides,
    },
    key.kid,
    key.privateKey,
  );
}

function testConfig(): ServiceConfig {
  return readConfig({
    PUBLIC_ISSUER_URL: "http://localhost:4000",
    MCP_RESOURCE_URL: "http://localhost:4000",
    ACTIONS_AUDIENCE: "http://localhost:4000/actions",
  });
}

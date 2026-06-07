import assert from "node:assert/strict";
import { createSign, type KeyObject } from "node:crypto";
import test from "node:test";
import { ServiceError } from "../../shared/errors.ts";
import { readConfig, type ServiceConfig } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";
import { getSigningKey } from "../../auth/tokens/signing-keys.ts";
import { signJwt } from "../../auth/tokens/jwt.ts";
import { verifyAccessToken } from "../../auth/tokens/access-token.ts";
import { encodeJsonBase64Url } from "../../shared/base64url.ts";
import { testStaticUser } from "../support/static-user.ts";

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

test("access token verifier rejects oversized signed JWT input", () => {
  const config = testConfig();
  const token = signedAccessToken(config, { pad: "x".repeat(7000) });
  assert.ok(token.length > 8192);
  assertRejectsRawToken(config, token);
});

test("access token verifier rejects unsupported JWT header fields", () => {
  const config = testConfig();
  const key = getSigningKey(config);
  assertRejectsRawToken(config, signedAccessTokenWithHeader(config, { alg: "RS256", kid: key.kid, typ: "access-token+jwt" }, {}));
  assertRejectsRawToken(config, signedAccessTokenWithHeader(config, { alg: "RS256", kid: key.kid, typ: "JWT", crit: [] }, {}));
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
  const key = getSigningKey(config);
  return signJwt(accessClaims(config, overrides), key.kid, key.privateKey);
}

function signedAccessTokenWithHeader(config: ServiceConfig, header: Record<string, unknown>, overrides: Record<string, unknown>): string {
  return signRawJwt(header, accessClaims(config, overrides), getSigningKey(config).privateKey);
}

function accessClaims(config: ServiceConfig, overrides: Record<string, unknown>): Record<string, unknown> {
  const now = nowSeconds();
  return {
    iss: config.issuer,
    sub: testStaticUser.sub,
    aud: config.actionsAudience,
    exp: now + 900,
    iat: now,
    nbf: now,
    jti: "token-claim-test",
    client_id: "local-test",
    scope: "openid profile email",
    ...overrides,
  };
}

function signRawJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: KeyObject): string {
  const signingInput = `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(payload)}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

function testConfig(): ServiceConfig {
  return readConfig({
    PUBLIC_ISSUER_URL: "http://localhost:4000",
    MCP_RESOURCE_URL: "http://localhost:4000/mcp",
    ACTIONS_AUDIENCE: "http://localhost:4000/actions",
  });
}

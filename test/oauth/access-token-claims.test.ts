import assert from "node:assert/strict";
import { createSign, type KeyObject } from "node:crypto";
import test from "node:test";
import { readConfig, type ServiceConfig } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";
import { getSigningKey } from "../../auth/tokens/signing-keys.ts";
import { signJwt } from "../../auth/tokens/jwt.ts";
import { verifyAccessToken } from "../../auth/tokens/access-token.ts";
import { AccessTokenValidationError, type AccessTokenFailureReason } from "../../auth/tokens/access-token-error.ts";
import { encodeJsonBase64Url } from "../../shared/base64url.ts";
import { testUserProfile } from "../support/user-profile.ts";

test("access token verifier rejects future issued-at values", () => {
  const config = testConfig();
  assertRejectsToken(config, { iat: nowSeconds() + 60 }, "token_issued_in_future");
});

test("access token verifier rejects non-integer NumericDate values", () => {
  const config = testConfig();
  assertRejectsToken(config, { exp: nowSeconds() + 900.5 }, "invalid_numeric_date");
  assertRejectsToken(config, { nbf: 0.5 }, "invalid_numeric_date");
});

test("access token verifier rejects empty string claims", () => {
  const config = testConfig();
  assertRejectsToken(config, { sub: "" }, "missing_required_claim");
  assertRejectsToken(config, { client_id: " " }, "missing_required_claim");
  assertRejectsToken(config, { jti: "" }, "missing_required_claim");
});

test("access token verifier rejects malformed scope strings", () => {
  const config = testConfig();
  assertRejectsToken(config, { scope: "" }, "missing_required_claim");
  assertRejectsToken(config, { scope: "openid\nprofile" }, "invalid_scope_claim");
  assertRejectsToken(config, { scope: "openid profile " }, "missing_required_claim");
  assertRejectsToken(config, { scope: "openid bad!scope" }, "invalid_scope_claim");
});

test("access token verifier rejects malformed JWT input as unauthorized", () => {
  const config = testConfig();
  assertRejectsRawToken(config, "not-a-jwt", "jwt_malformed");
  assertRejectsRawToken(config, "aaa.bbb.ccc", "jwt_invalid_header");
  assertRejectsRawToken(config, `${signedAccessToken(config, {}).split(".").slice(0, 2).join(".")}.%%%`, "jwt_invalid_signature");
});

test("access token verifier rejects oversized signed JWT input", () => {
  const config = testConfig();
  const token = signedAccessToken(config, { pad: "x".repeat(7000) });
  assert.ok(token.length > 8192);
  assertRejectsRawToken(config, token, "jwt_oversized");
});

test("access token verifier rejects unsupported JWT header fields", () => {
  const config = testConfig();
  const key = getSigningKey(config);
  assertRejectsRawToken(config, signedAccessTokenWithHeader(config, { alg: "RS256", kid: key.kid, typ: "access-token+jwt" }, {}), "jwt_invalid_header");
  assertRejectsRawToken(config, signedAccessTokenWithHeader(config, { alg: "RS256", kid: key.kid, typ: "JWT", crit: [] }, {}), "jwt_invalid_header");
});

test("access token verifier reports audience and expiration reasons", () => {
  const config = testConfig();
  assertRejectsToken(config, { aud: config.mcpResource }, "audience_mismatch");
  assertRejectsToken(config, { exp: nowSeconds() - 1 }, "token_expired");
});

function assertRejectsToken(config: ServiceConfig, overrides: Record<string, unknown>, reason: AccessTokenFailureReason): void {
  assertRejectsRawToken(config, signedAccessToken(config, overrides), reason);
}

function assertRejectsRawToken(config: ServiceConfig, token: string, reason: AccessTokenFailureReason): void {
  assert.throws(
    () => verifyAccessToken(config, token, config.actionsAudience),
    (error) => error instanceof AccessTokenValidationError && error.code === "unauthorized" && error.reason === reason,
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
    sub: testUserProfile.sub,
    aud: config.actionsAudience,
    exp: now + 900,
    iat: now,
    nbf: now,
    jti: "token-claim-test",
    client_id: "local-test",
    scope: "openid profile email",
    name: testUserProfile.name,
    given_name: testUserProfile.given_name,
    family_name: testUserProfile.family_name,
    preferred_username: testUserProfile.preferred_username,
    email: testUserProfile.email,
    email_verified: testUserProfile.email_verified,
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

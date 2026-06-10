import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { verifyJwt, type JwksDocument } from "../../auth/upstream-oidc-jwt.ts";

test("upstream JWT verification accepts Cognito shaped key ids", () => {
  const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "m5rCqgilHpYnOHUCDDr63pD3zE8RdmcglZaok+REo/A=";
  const token = signJwt(key.privateKey, kid, { sub: "operator" });
  const jwks: JwksDocument = {
    keys: [{ ...key.publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" }],
  };

  const verified = verifyJwt(token, jwks, ["RS256"]);

  assert.equal(verified.header.kid, kid);
  assert.equal(verified.payload.sub, "operator");
});

test("upstream JWT verification rejects control characters in key ids", () => {
  const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "invalid\nkid";
  const token = signJwt(key.privateKey, kid, { sub: "operator" });
  const jwks: JwksDocument = {
    keys: [{ ...key.publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" }],
  };

  assert.throws(() => verifyJwt(token, jwks, ["RS256"]), /upstream token key id is invalid/);
});

function signJwt(privateKey: KeyObject, kid: string, payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createSign("sha256").update(`${header}.${body}`).end().sign(privateKey, "base64url");
  return `${header}.${body}.${signature}`;
}

import assert from "node:assert/strict";
import test from "node:test";
import { completeAuthorizationCodeFlow, localClient } from "../support/oauth-client.ts";
import { readJson, requireRecord, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { testStaticUser } from "../support/static-user.ts";

test("JWKS publishes the signing key for externally validated ID tokens", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const idToken = requireString(flow.tokens.id_token, "id_token");
  const header = decodeJwtHeader(idToken);
  assert.equal(header.alg, "RS256");
  assert.equal(header.typ, "JWT");
  assert.equal(flow.idClaims.iss, service.origin);
  assert.equal(flow.idClaims.aud, localClient.client_id);
  assert.equal(flow.idClaims.sub, testStaticUser.sub);
  assert.equal(flow.idClaims.email, testStaticUser.email);
  const jwks = await readJson(await fetch(requireString(flow.as.jwks_uri, "jwks_uri")));
  const keys = jwks.keys as Record<string, unknown>[];
  assert.ok(keys.some((key) => key.kid === header.kid && key.alg === "RS256" && key.use === "sig"));
});

function decodeJwtHeader(token: string): Record<string, unknown> {
  const [encodedHeader] = token.split(".");
  return requireRecord(JSON.parse(Buffer.from(requireString(encodedHeader, "jwt header"), "base64url").toString("utf8")), "jwt header");
}

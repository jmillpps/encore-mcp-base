import assert from "node:assert/strict";
import test from "node:test";
import { discover } from "../support/oauth-client.ts";
import { startService } from "../support/service-process.ts";

test("OAuth discovery is processable by oauth4webapi", async (t) => {
  const service = await startService(t);
  const metadata = await discover(service);
  assert.equal(metadata.issuer, service.origin);
  assert.equal(metadata.authorization_endpoint, `${service.origin}/oauth/authorize`);
  assert.equal(metadata.token_endpoint, `${service.origin}/oauth/token`);
  assert.equal(metadata.jwks_uri, `${service.origin}/oauth/jwks`);
  assert.deepEqual(metadata.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
});

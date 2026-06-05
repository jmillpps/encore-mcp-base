import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, localClient } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("authorization code flow issues externally processed OIDC tokens and userinfo", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.tokens.token_type, "bearer");
  assert.equal(flow.idClaims.iss, service.origin);
  assert.equal(flow.idClaims.aud, localClient.client_id);
  assert.equal(flow.idClaims.email, "jmiller@inifnitedevlab.com");
  assert.equal(flow.idClaims.name, "Justin Miller");
  const userInfoResponse = await oauth.userInfoRequest(flow.as, localClient, flow.tokens.access_token, {
    [oauth.allowInsecureRequests]: true,
  });
  const userInfo = await oauth.processUserInfoResponse(flow.as, localClient, flow.idClaims.sub, userInfoResponse);
  assert.equal(userInfo.email, "jmiller@inifnitedevlab.com");
  const store = await readFile(service.storePath, "utf8");
  assert.equal(store.includes(flow.code), false);
  assert.equal(store.includes(requireString(flow.tokens.refresh_token, "refresh_token")), false);
});

test("authorization code cannot be reused after token exchange", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const replay = await oauth.authorizationCodeGrantRequest(
    flow.as,
    localClient,
    oauth.ClientSecretPost("local-test-secret"),
    flow.callbackParameters,
    "http://localhost:4000/test/callback",
    flow.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  assert.equal(replay.status, 400);
  const body = await readJson(replay);
  assert.equal(body.error, "invalid_grant");
});

import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, localClient } from "../support/oauth-client.ts";
import { readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { testStaticUser } from "../support/static-user.ts";

test("userinfo accepts valid tokens issued for Actions and MCP resources", async (t) => {
  const service = await startService(t);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const mcpFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  for (const flow of [actionsFlow, mcpFlow]) {
    const response = await oauth.userInfoRequest(flow.as, localClient, flow.tokens.access_token, {
      [oauth.allowInsecureRequests]: true,
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
    const userInfo = await oauth.processUserInfoResponse(flow.as, localClient, flow.idClaims.sub, response);
    assert.equal(userInfo.email, testStaticUser.email);
  }
  const lowerCaseBearer = await fetch(`${service.origin}/oauth/userinfo`, { headers: { authorization: `bearer ${actionsFlow.tokens.access_token}` } });
  assert.equal(lowerCaseBearer.status, 200);
  assert.equal((await readJson(lowerCaseBearer)).email, testStaticUser.email);
  const queryToken = await fetch(`${service.origin}/oauth/userinfo?access_token=query-token`, { headers: { authorization: `Bearer ${actionsFlow.tokens.access_token}` } });
  assert.equal(queryToken.status, 400);
  assert.equal((await readJson(queryToken)).error, "bad_request");
});

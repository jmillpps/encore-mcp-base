import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, localClient } from "../support/oauth-client.ts";
import { startService } from "../support/service-process.ts";

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
    assert.equal(userInfo.email, "jmiller@inifnitedevlab.com");
  }
});

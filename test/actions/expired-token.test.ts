import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { bearer } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("Actions endpoints reject expired bearer tokens", async (t) => {
  const service = await startService(t, { ACCESS_TOKEN_TTL_SECONDS: "1" });
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  await delay(1100);
  const response = await fetch(`${service.origin}/actions/profile`, {
    headers: { authorization: bearer(flow.tokens.access_token) },
  });
  assert.equal(response.status, 401);
});

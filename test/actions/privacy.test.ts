import assert from "node:assert/strict";
import test from "node:test";
import { startService } from "../support/service-process.ts";

test("privacy endpoint serves the public policy page", async (t) => {
  const service = await startService(t);
  const response = await fetch(`${service.origin}/privacy`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(response.headers.get("cache-control") ?? "", /max-age=300/);
  const body = await response.text();
  assert.match(body, /GPT MCP Service Privacy Policy/);
  assert.match(body, /OAuth/);
});

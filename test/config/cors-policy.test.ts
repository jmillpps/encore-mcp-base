import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readConfig } from "../../shared/config.ts";

test("Encore CORS policy pins MCP browser origins and headers", async () => {
  const app = JSON.parse(await readFile("encore.app", "utf8")) as Record<string, unknown>;
  const globalCors = record(app.global_cors, "global_cors");
  const expectedOrigins = readConfig({}).allowedOrigins;
  assert.deepEqual(strings(globalCors.allow_origins_without_credentials, "allow_origins_without_credentials"), expectedOrigins);
  assert.deepEqual(strings(globalCors.allow_origins_with_credentials, "allow_origins_with_credentials"), expectedOrigins);
  assert.deepEqual(strings(globalCors.allow_headers, "allow_headers"), [
    "Authorization",
    "Content-Type",
    "Accept",
    "MCP-Protocol-Version",
    "MCP-Session-Id",
    "Last-Event-ID",
  ]);
  assert.deepEqual(strings(globalCors.expose_headers, "expose_headers"), ["WWW-Authenticate", "MCP-Session-Id"]);
});

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) assert.fail(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) assert.fail(`${name} must be a string array`);
  assert.equal(value.some((entry) => entry.includes("*")), false);
  return value;
}

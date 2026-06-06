import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readJson, requireRecord, requireString } from "../support/http.ts";

test("OpenAPI export contains Actions endpoints and OAuth authorization code metadata", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://example.test"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const document = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document["x-generated-from"], "encore-compiled-route-graph");
  const paths = document.paths as Record<string, Record<string, unknown>>;
  assert.ok(requireRecord(paths["/health"], "/health").get);
  const profile = requireRecord(requireRecord(paths["/actions/profile"], "/actions/profile").get, "profile get");
  const session = requireRecord(requireRecord(paths["/actions/session"], "/actions/session").get, "session get");
  assert.deepEqual(profile.security, [{ OAuth2: ["openid", "profile", "email"] }]);
  assert.deepEqual(session.security, [{ OAuth2: ["openid"] }]);
  assert.ok(requireRecord(profile.responses, "profile responses")["403"]);
  assert.ok(requireRecord(session.responses, "session responses")["403"]);
  const components = document.components as Record<string, unknown>;
  const securitySchemes = (components.securitySchemes as Record<string, unknown>);
  const oauth = securitySchemes.OAuth2 as Record<string, unknown>;
  assert.equal(oauth.type, "oauth2");
  const flow = ((oauth.flows as Record<string, unknown>).authorizationCode as Record<string, unknown>);
  assert.equal(flow.authorizationUrl, "https://example.test/oauth/authorize");
  assert.equal(flow.tokenUrl, "https://example.test/oauth/token");
  assert.deepEqual(Object.keys(flow.scopes as Record<string, string>).sort(), ["email", "openid", "profile"]);
  const schemas = requireRecord(components.schemas, "schemas");
  const errorResponse = requireRecord(schemas.ErrorResponse, "ErrorResponse");
  assert.deepEqual(errorResponse.required, ["code", "message", "details", "internal_message"]);
  assert.ok(requireRecord(errorResponse.properties, "ErrorResponse properties").internal_message);
});

test("OpenAPI export can write a generated artifact", async (t) => {
  const out = "var/test-openapi.json";
  t.after(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(out, { force: true }));
  });
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "http://localhost:4000", "--out", out], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  const response = new Response(await import("node:fs/promises").then((fs) => fs.readFile(out, "utf8")));
  const document = await readJson(response);
  assert.equal(requireString((document.servers as Record<string, unknown>[])[0]?.url, "server url"), "http://localhost:4000");
});

test("OpenAPI export rejects base URLs with unsupported URL parts", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://example.test?debug=true"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported URL parts/);
});

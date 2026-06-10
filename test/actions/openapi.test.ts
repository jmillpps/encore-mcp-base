import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { openApiDocument } from "../../actions/openapi-document.ts";
import { assertChatGptActionsOpenApi } from "../../tools/openapi-actions-compatibility.ts";
import { readJson, requireRecord, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("OpenAPI export contains Actions endpoints and OAuth authorization code metadata", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://example.test"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const document = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document["x-source"], "manual-actions-document");
  assert.equal(document["x-route-graph-verification"], "encore-check");
  assert.match(requireString(requireRecord(document.info, "info").description, "info description"), /OAuth-protected/);
  const paths = document.paths as Record<string, Record<string, unknown>>;
  const health = requireRecord(requireRecord(paths["/health"], "/health").get, "health get");
  assert.equal(health.operationId, "getServiceHealth");
  assert.equal(health.summary, "Check service health");
  assert.match(requireString(health.description, "health description"), /service is reachable/);
  assert.equal(health["x-openai-isConsequential"], false);
  const profile = requireRecord(requireRecord(paths["/actions/profile"], "/actions/profile").get, "profile get");
  const session = requireRecord(requireRecord(paths["/actions/session"], "/actions/session").get, "session get");
  assert.equal(profile.operationId, "getAuthenticatedProfile");
  assert.equal(profile.summary, "Get authenticated profile");
  assert.match(requireString(profile.description, "profile description"), /OpenID Connect profile/);
  assert.equal(session.operationId, "getAuthenticatedSession");
  assert.equal(session.summary, "Get authenticated session");
  assert.match(requireString(session.description, "session description"), /OAuth token session/);
  assert.equal(profile["x-openai-isConsequential"], false);
  assert.equal(session["x-openai-isConsequential"], false);
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
  const healthResponse = requireRecord(schemas.HealthResponse, "HealthResponse");
  assert.match(requireString(healthResponse.description, "HealthResponse description"), /reachability/);
  const healthProperties = requireRecord(healthResponse.properties, "HealthResponse properties");
  assert.match(requireString(requireRecord(healthProperties.status, "HealthResponse status").description, "HealthResponse status description"), /health status/);
  const errorResponse = requireRecord(schemas.ErrorResponse, "ErrorResponse");
  assert.match(requireString(errorResponse.description, "ErrorResponse description"), /error response/);
  assert.deepEqual(errorResponse.required, ["code", "message", "details", "internal_message"]);
  const errorProperties = requireRecord(errorResponse.properties, "ErrorResponse properties");
  assert.match(requireString(requireRecord(errorProperties.internal_message, "ErrorResponse internal_message").description, "ErrorResponse internal_message description"), /live error contract/);
});

test("OpenAPI endpoint returns the Actions schema for URL import", async (t) => {
  const service = await startService(t);
  const response = await fetch(`${service.origin}/actions/openapi.json`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  const document = await readJson(response);
  assert.deepEqual(document, openApiDocument(service.origin));
  assert.doesNotThrow(() => assertChatGptActionsOpenApi(document));
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

test("OpenAPI export rejects output paths outside the project", async (t) => {
  const out = "../mcp-service-openapi-escape.json";
  t.after(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(out, { force: true }));
  });
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "http://localhost:4000", "--out", out], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /output path must stay inside the project/);
});

test("OpenAPI export writes only JSON artifacts", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "http://localhost:4000", "--out", "var/test-openapi.txt"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /output path must end with \.json/);
});

test("OpenAPI export rejects base URLs with unsupported URL parts", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://example.test?debug=true"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported URL parts/);
});

test("OpenAPI export rejects base URLs with unsupported deployment paths", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://example.test/base"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not include a path/);
});

test("OpenAPI export rejects private HTTPS base URLs", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "https://localhost"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public host/);
});

test("OpenAPI export rejects public HTTP base URLs", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "tools/export-openapi.ts", "--base-url", "http://example.test"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public base URL must use https/);
});

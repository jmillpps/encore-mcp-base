import assert from "node:assert/strict";
import test from "node:test";
import { assertChatGptActionsOpenApi } from "../../tools/openapi-actions-compatibility.ts";
import { openApiDocument } from "../../tools/openapi-document.ts";

test("OpenAPI Actions compatibility accepts the generated document", () => {
  assert.doesNotThrow(() => assertChatGptActionsOpenApi(openApiDocument("https://example.test")));
});

test("OpenAPI Actions compatibility enforces ChatGPT production limits", () => {
  assertRejects((document) => {
    profileOperation(document).description = "x".repeat(301);
  }, /description/);
  assertRejects((document) => {
    profileOperation(document)["x-openai-isConsequential"] = undefined;
  }, /x-openai-isConsequential/);
  assertRejects((document) => {
    profileOperation(document).parameters = [{ in: "header", name: "X-Custom", schema: { type: "string" }, description: "custom header" }];
  }, /custom headers/);
  assertRejects((document) => {
    profileOperation(document).parameters = [{ in: "query", name: "q", schema: { type: "string" }, description: "x".repeat(701) }];
  }, /parameter description/);
  assertRejects((document) => {
    oauthFlow(document).authorizationUrl = "https://auth.example.test/oauth/authorize";
  }, /authorizationUrl/);
  assertRejects((document) => {
    profileOkContent(document)["text/plain"] = { schema: { type: "string" } };
  }, /application\/json/);
});

type JsonObject = Record<string, unknown>;

function assertRejects(mutate: (document: JsonObject) => void, pattern: RegExp): void {
  const document = openApiDocument("https://example.test") as JsonObject;
  mutate(document);
  assert.throws(() => assertChatGptActionsOpenApi(document), pattern);
}

function profileOperation(document: JsonObject): JsonObject {
  return object(object(object(document.paths, "paths")["/actions/profile"], "profile path").get, "profile get");
}

function oauthFlow(document: JsonObject): JsonObject {
  const components = object(document.components, "components");
  const schemes = object(components.securitySchemes, "security schemes");
  const oauth2 = object(schemes.OAuth2, "OAuth2");
  const flows = object(oauth2.flows, "OAuth2 flows");
  return object(flows.authorizationCode, "authorization code flow");
}

function profileOkContent(document: JsonObject): JsonObject {
  const responses = object(profileOperation(document).responses, "profile responses");
  const ok = object(responses["200"], "profile response 200");
  return object(ok.content, "profile response 200 content");
}

function object(value: unknown, name: string): JsonObject {
  assert.equal(typeof value, "object", `${name} must be an object`);
  assert.notEqual(value, null, `${name} must be an object`);
  assert.equal(Array.isArray(value), false, `${name} must be an object`);
  return value as JsonObject;
}

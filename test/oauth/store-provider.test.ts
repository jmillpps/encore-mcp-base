import assert from "node:assert/strict";
import test from "node:test";
import { metadataCacheStore, oauthStore, rateLimitStore } from "../../auth/storage/store-provider.ts";
import { readConfig } from "../../shared/config.ts";

test("DynamoDB store provider reuses stores for the same table, region, and endpoint", () => {
  const config = dynamoDbConfig();
  assert.equal(oauthStore(config), oauthStore(config));
  assert.equal(rateLimitStore(config), rateLimitStore(config));
  assert.equal(metadataCacheStore(config), metadataCacheStore(config));
});

test("DynamoDB store provider separates different deployment targets", () => {
  const first = dynamoDbConfig({ OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state-a" });
  const second = dynamoDbConfig({ OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state-b" });
  assert.notEqual(oauthStore(first), oauthStore(second));
  assert.notEqual(rateLimitStore(first), rateLimitStore(second));
  assert.notEqual(metadataCacheStore(first), metadataCacheStore(second));
});

test("file store provider keeps path-local disk store construction", () => {
  const config = readConfig({ OAUTH_STORE_PATH: "var/provider-test-oauth-store.json" });
  assert.notEqual(oauthStore(config), oauthStore(config));
  assert.notEqual(rateLimitStore(config), rateLimitStore(config));
  assert.equal(metadataCacheStore(config), undefined);
});

function dynamoDbConfig(overrides: NodeJS.ProcessEnv = {}) {
  return readConfig({
    OAUTH_STORE_BACKEND: "dynamodb",
    OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state",
    OAUTH_DYNAMODB_REGION: "us-east-1",
    OAUTH_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
    ...overrides,
  });
}

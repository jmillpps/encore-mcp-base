import assert from "node:assert/strict";
import test from "node:test";
import { DynamoDbMetadataCacheStore } from "../../auth/storage/dynamodb/metadata-cache-store.ts";
import { readConfig } from "../../shared/config.ts";
import { FakeDynamoDbClient } from "../support/fake-dynamodb-client.ts";

test("DynamoDB metadata cache stores metadata and JWKS entries by namespace", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbMetadataCacheStore(config(), client);
  await store.write("client-metadata", "same-cache-key", { client_id: "https://client.example.test/client.json" }, 60);
  await store.write("client-jwks", "same-cache-key", { keys: [{ kid: "metadata-key" }] }, 60);

  assert.deepEqual((await store.read("client-metadata", "same-cache-key"))?.body, { client_id: "https://client.example.test/client.json" });
  assert.deepEqual((await store.read("client-jwks", "same-cache-key"))?.body, { keys: [{ kid: "metadata-key" }] });
});

test("DynamoDB metadata cache removes entries for no-store responses", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbMetadataCacheStore(config(), client);
  await store.write("client-metadata", "metadata-cache-key", { cached: true }, 60);
  assert.deepEqual((await store.read("client-metadata", "metadata-cache-key"))?.body, { cached: true });
  await store.write("client-metadata", "metadata-cache-key", { cached: false }, 0);
  assert.equal(await store.read("client-metadata", "metadata-cache-key"), undefined);
});

function config() {
  return readConfig({
    OAUTH_STORE_BACKEND: "dynamodb",
    OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state",
    OAUTH_DYNAMODB_REGION: "us-east-1",
    OAUTH_DYNAMODB_ENDPOINT: "http://127.0.0.1:8000",
  });
}

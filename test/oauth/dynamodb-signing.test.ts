import assert from "node:assert/strict";
import test from "node:test";
import { signDynamoDbRequest } from "../../auth/storage/dynamodb/signing.ts";

test("DynamoDB SigV4 signer signs host without sending a manual host header", () => {
  const signed = signDynamoDbRequest({
    region: "us-east-1",
    target: "DynamoDB_20120810.GetItem",
    body: "{}",
    date: new Date("2026-01-01T00:00:00.000Z"),
    credentials: {
      accessKeyId: "TESTACCESSKEYID",
      secretAccessKey: "test-secret-key",
      sessionToken: "test-session-token",
    },
  });
  assert.equal("host" in signed.headers, false);
  const authorization = signed.headers.authorization;
  assert.ok(authorization);
  assert.match(authorization, /SignedHeaders=content-type;host;x-amz-date;x-amz-security-token;x-amz-target/);
  assert.equal(signed.headers["x-amz-security-token"], "test-session-token");
  assert.equal(authorization.includes("test-secret-key"), false);
});

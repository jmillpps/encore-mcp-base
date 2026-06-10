import { randomToken, s256Challenge, sha256Base64Url } from "../../../shared/crypto.ts";
import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import { pkceVerifier } from "../../pkce.ts";
import type { AuthorizationCodeExpectation, AuthorizationCodeInput } from "../store-inputs.ts";
import type { AuthorizationCodeRecord } from "../store-records.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import { authorizationCodeKey } from "./keys.ts";
import { numberAttr, stringAttr } from "./attribute-value.ts";
import { parseStoredRecord, storedRecordItem } from "./item-codec.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

export async function createAuthorizationCode(ctx: DynamoDbStoreContext, input: AuthorizationCodeInput): Promise<string> {
  const code = randomToken(32);
  const createdAt = nowSeconds();
  const record: AuthorizationCodeRecord = {
    codeHash: sha256Base64Url(code),
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    resource: input.resource,
    scopes: input.scopes,
    user: input.user,
    expiresAt: createdAt + input.ttlSeconds,
    authTime: createdAt,
    createdAt,
    ...(input.nonce ? { nonce: input.nonce } : {}),
    ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
    ...(input.codeChallengeMethod ? { codeChallengeMethod: input.codeChallengeMethod } : {}),
  };
  await ctx.client.putItem({
    TableName: ctx.tableName,
    Item: storedRecordItem({
      key: authorizationCodeKey(record.codeHash),
      type: "authorization_code",
      record,
      expiresAt: record.expiresAt,
      extra: { clientId: stringAttr(record.clientId) },
    }),
    ConditionExpression: "attribute_not_exists(pk)",
  });
  return code;
}

export async function consumeAuthorizationCode(
  ctx: DynamoDbStoreContext,
  code: string,
  verifier: string | undefined,
  expected: AuthorizationCodeExpectation,
): Promise<AuthorizationCodeRecord> {
  const key = authorizationCodeKey(sha256Base64Url(code));
  const record = parseStoredRecord<AuthorizationCodeRecord>(await ctx.client.getItem({ TableName: ctx.tableName, Key: key, ConsistentRead: true }), "authorization_code");
  const now = nowSeconds();
  validateAuthorizationCode(record, verifier, expected, now);
  const consumedRecord = { ...record, consumedAt: now };
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: key,
      UpdateExpression: "SET #record = :record, #consumedAt = :now",
      ConditionExpression: "attribute_not_exists(#consumedAt) AND #expiresAt > :now",
      ExpressionAttributeNames: { "#record": "record", "#consumedAt": "consumedAt", "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":record": stringAttr(JSON.stringify(consumedRecord)), ":now": numberAttr(now) },
    });
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) throw invalidGrant();
    throw error;
  }
  return consumedRecord;
}

function validateAuthorizationCode(
  record: AuthorizationCodeRecord | undefined,
  verifier: string | undefined,
  expected: AuthorizationCodeExpectation,
  now: number,
): asserts record is AuthorizationCodeRecord {
  if (!record || record.consumedAt || record.expiresAt <= now) throw invalidGrant();
  if (record.clientId !== expected.clientId || record.redirectUri !== expected.redirectUri) throw invalidGrant();
  if (expected.resource !== undefined && record.resource !== expected.resource) throw invalidGrant();
  if (expected.allowedResources && !expected.allowedResources.includes(record.resource)) throw invalidGrant();
  if (expected.allowedScopes && record.scopes.some((scope) => !expected.allowedScopes?.includes(scope))) throw invalidGrant();
  if (record.codeChallenge && s256Challenge(pkceVerifier(verifier)) !== record.codeChallenge) throw invalidGrant();
}

function invalidGrant(): ServiceError {
  return new ServiceError("invalid_grant", "invalid grant", 400);
}

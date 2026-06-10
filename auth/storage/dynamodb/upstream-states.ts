import { randomToken, sha256Base64Url } from "../../../shared/crypto.ts";
import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { UpstreamAuthorizationStateInput } from "../store-inputs.ts";
import type { UpstreamAuthorizationStateRecord } from "../store-records.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import { numberAttr, stringAttr } from "./attribute-value.ts";
import { parseStoredRecord, storedRecordItem } from "./item-codec.ts";
import { upstreamStateKey } from "./keys.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

export async function createUpstreamAuthorizationState(ctx: DynamoDbStoreContext, input: UpstreamAuthorizationStateInput): Promise<string> {
  const state = randomToken(32);
  const createdAt = nowSeconds();
  const record: UpstreamAuthorizationStateRecord = {
    stateHash: sha256Base64Url(state),
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    resource: input.resource,
    scopes: input.scopes,
    clientState: input.clientState,
    codeVerifier: input.codeVerifier,
    upstreamNonce: input.upstreamNonce,
    expiresAt: createdAt + input.ttlSeconds,
    createdAt,
    ...(input.nonce ? { nonce: input.nonce } : {}),
    ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
    ...(input.codeChallengeMethod ? { codeChallengeMethod: input.codeChallengeMethod } : {}),
  };
  await ctx.client.putItem({
    TableName: ctx.tableName,
    Item: storedRecordItem({
      key: upstreamStateKey(record.stateHash),
      type: "upstream_state",
      record,
      expiresAt: record.expiresAt,
      extra: { clientId: stringAttr(record.clientId) },
    }),
    ConditionExpression: "attribute_not_exists(pk)",
  });
  return state;
}

export async function consumeUpstreamAuthorizationState(ctx: DynamoDbStoreContext, state: string): Promise<UpstreamAuthorizationStateRecord> {
  const now = nowSeconds();
  const key = upstreamStateKey(sha256Base64Url(state));
  try {
    const item = await ctx.client.deleteItem({
      TableName: ctx.tableName,
      Key: key,
      ReturnValues: "ALL_OLD",
      ConditionExpression: "#expiresAt > :now",
      ExpressionAttributeNames: { "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":now": numberAttr(now) },
    });
    const record = parseStoredRecord<UpstreamAuthorizationStateRecord>(item, "upstream_state");
    if (!record) throw invalidGrant();
    return record;
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) throw invalidGrant();
    throw error;
  }
}

function invalidGrant(): ServiceError {
  return new ServiceError("invalid_grant", "invalid grant", 400);
}

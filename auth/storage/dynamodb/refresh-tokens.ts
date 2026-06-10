import { randomToken, sha256Base64Url } from "../../../shared/crypto.ts";
import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { RefreshTokenInput } from "../store-inputs.ts";
import type { RefreshTokenRecord } from "../store-records.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import { numberAttr, readNumber, readOptionalNumber, stringAttr } from "./attribute-value.ts";
import { markerItem, metaItem, parseStoredRecord, storedRecordItem } from "./item-codec.ts";
import { refreshFamilyKey, refreshRotationKey, refreshTokenKey } from "./keys.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

export async function createRefreshToken(ctx: DynamoDbStoreContext, input: RefreshTokenInput): Promise<string> {
  const token = randomToken(32);
  const createdAt = nowSeconds();
  const record = refreshRecord(token, randomToken(18), input, createdAt, createdAt + input.ttlSeconds);
  await ctx.client.transactWriteItems({
    TransactItems: [
      { Put: { TableName: ctx.tableName, Item: refreshTokenItem(record), ConditionExpression: "attribute_not_exists(pk)" } },
      { Put: { TableName: ctx.tableName, Item: refreshFamilyItem(record), ConditionExpression: "attribute_not_exists(pk)" } },
    ],
  });
  return token;
}

export async function rotateRefreshToken(
  ctx: DynamoDbStoreContext,
  token: string,
  clientId: string,
  ttlSeconds: number,
  expectedResource?: string,
  allowedResources?: readonly string[],
): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }> {
  const oldHash = sha256Base64Url(token);
  const oldKey = refreshTokenKey(oldHash);
  const oldRecord = parseStoredRecord<RefreshTokenRecord>(await ctx.client.getItem({ TableName: ctx.tableName, Key: oldKey, ConsistentRead: true }), "refresh_token");
  const now = nowSeconds();
  validateRefreshToken(oldRecord, clientId, expectedResource, allowedResources, now);
  const family = await ctx.client.getItem({ TableName: ctx.tableName, Key: refreshFamilyKey(oldRecord.familyId), ConsistentRead: true });
  if (!family || readOptionalNumber(family, "revokedAt") !== undefined || readNumber(family, "expiresAt") <= now) throw invalidGrant();
  if (await ctx.client.getItem({ TableName: ctx.tableName, Key: refreshRotationKey(oldHash), ConsistentRead: true })) {
    await revokeRefreshFamily(ctx, oldRecord.familyId, now);
    throw invalidGrant();
  }
  return rotateValidRefreshToken(ctx, oldRecord, oldKey, oldHash, ttlSeconds, now);
}

async function rotateValidRefreshToken(
  ctx: DynamoDbStoreContext,
  oldRecord: RefreshTokenRecord,
  oldKey: ReturnType<typeof refreshTokenKey>,
  oldHash: string,
  ttlSeconds: number,
  now: number,
): Promise<{ oldRecord: RefreshTokenRecord; newToken: string }> {
  const newToken = randomToken(32);
  const newRecord: RefreshTokenRecord = {
    ...oldRecord,
    tokenHash: sha256Base64Url(newToken),
    expiresAt: now + ttlSeconds,
    rotatedFromHash: oldHash,
    createdAt: now,
    lastUsedAt: undefined,
    revokedAt: undefined,
  };
  const usedRecord = { ...oldRecord, lastUsedAt: now };
  try {
    await ctx.client.transactWriteItems({
      TransactItems: [
        { Put: { TableName: ctx.tableName, Item: refreshTokenItem(newRecord), ConditionExpression: "attribute_not_exists(pk)" } },
        { Put: { TableName: ctx.tableName, Item: markerItem(refreshRotationKey(oldHash), oldRecord.familyId, now, newRecord.expiresAt), ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: updateOldToken(ctx.tableName, oldKey, usedRecord, now) },
        { Update: updateFamilyTtl(ctx.tableName, oldRecord.familyId, newRecord.expiresAt, now) },
      ],
    });
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) {
      await revokeRefreshFamily(ctx, oldRecord.familyId, now);
      throw invalidGrant();
    }
    throw error;
  }
  return { oldRecord: usedRecord, newToken };
}

function refreshRecord(token: string, familyId: string, input: RefreshTokenInput, createdAt: number, expiresAt: number): RefreshTokenRecord {
  return { tokenHash: sha256Base64Url(token), familyId, clientId: input.clientId, user: input.user, resource: input.resource, scopes: input.scopes, expiresAt, authTime: input.authTime, createdAt };
}

function refreshTokenItem(record: RefreshTokenRecord) {
  return storedRecordItem({
    key: refreshTokenKey(record.tokenHash),
    type: "refresh_token",
    record,
    expiresAt: record.expiresAt,
    extra: { familyId: stringAttr(record.familyId), clientId: stringAttr(record.clientId), resource: stringAttr(record.resource) },
  });
}

function refreshFamilyItem(record: RefreshTokenRecord) {
  return metaItem(refreshFamilyKey(record.familyId), "refresh_family", record.expiresAt, {
    familyId: stringAttr(record.familyId),
    clientId: stringAttr(record.clientId),
  });
}

function updateOldToken(tableName: string, key: ReturnType<typeof refreshTokenKey>, record: RefreshTokenRecord, now: number) {
  return {
    TableName: tableName,
    Key: key,
    UpdateExpression: "SET #record = :record, #lastUsedAt = :now",
    ConditionExpression: "attribute_not_exists(#revokedAt) AND #expiresAt > :now",
    ExpressionAttributeNames: { "#record": "record", "#lastUsedAt": "lastUsedAt", "#revokedAt": "revokedAt", "#expiresAt": "expiresAt" },
    ExpressionAttributeValues: { ":record": stringAttr(JSON.stringify(record)), ":now": numberAttr(now) },
  };
}

function updateFamilyTtl(tableName: string, familyId: string, expiresAt: number, now: number) {
  return {
    TableName: tableName,
    Key: refreshFamilyKey(familyId),
    UpdateExpression: "SET #expiresAt = :expiresAt, #ttl = :expiresAt",
    ConditionExpression: "attribute_not_exists(#revokedAt) AND #expiresAt > :now",
    ExpressionAttributeNames: { "#expiresAt": "expiresAt", "#ttl": "ttl", "#revokedAt": "revokedAt" },
    ExpressionAttributeValues: { ":expiresAt": numberAttr(expiresAt), ":now": numberAttr(now) },
  };
}

async function revokeRefreshFamily(ctx: DynamoDbStoreContext, familyId: string, now: number): Promise<void> {
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: refreshFamilyKey(familyId),
      UpdateExpression: "SET #revokedAt = :now",
      ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(#revokedAt)",
      ExpressionAttributeNames: { "#revokedAt": "revokedAt" },
      ExpressionAttributeValues: { ":now": numberAttr(now) },
    });
  } catch (error) {
    if (!(error instanceof DynamoDbConditionalCheckFailed)) throw error;
  }
}

function validateRefreshToken(
  record: RefreshTokenRecord | undefined,
  clientId: string,
  expectedResource: string | undefined,
  allowedResources: readonly string[] | undefined,
  now: number,
): asserts record is RefreshTokenRecord {
  if (!record || record.revokedAt || record.expiresAt <= now) throw invalidGrant();
  if (record.clientId !== clientId) throw invalidGrant();
  if (expectedResource !== undefined && record.resource !== expectedResource) throw invalidGrant();
  if (allowedResources && !allowedResources.includes(record.resource)) throw invalidGrant();
}

function invalidGrant(): ServiceError {
  return new ServiceError("invalid_grant", "invalid grant", 400);
}

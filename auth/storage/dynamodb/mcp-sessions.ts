import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { McpSessionRecord } from "../store-records.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import type { DynamoDbItem } from "./attribute-value.ts";
import { numberAttr, readNumber, readOptionalNumber, readString, readStringSet, stringAttr, stringSetAttr } from "./attribute-value.ts";
import { metaItem } from "./item-codec.ts";
import { mcpSessionKey } from "./keys.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

const maxMcpRequestIds = 4096;

export async function saveMcpSession(ctx: DynamoDbStoreContext, record: McpSessionRecord): Promise<void> {
  await ctx.client.putItem({
    TableName: ctx.tableName,
    Item: {
      ...metaItem(mcpSessionKey(record.sessionIdHash), "mcp_session", record.expiresAt, {
        sessionIdHash: stringAttr(record.sessionIdHash),
        clientId: stringAttr(record.clientId),
        protocolVersion: stringAttr(record.protocolVersion),
        createdAt: numberAttr(record.createdAt),
        lastSeenAt: numberAttr(record.lastSeenAt),
        requestIdCount: numberAttr(0),
      }),
    },
    ConditionExpression: "attribute_not_exists(pk)",
  });
}

export async function touchMcpSession(
  ctx: DynamoDbStoreContext,
  sessionIdHash: string,
  protocolVersion: string | undefined,
  markInitialized = false,
): Promise<{ initialized: boolean }> {
  const now = nowSeconds();
  const key = mcpSessionKey(sessionIdHash);
  const item = await ctx.client.getItem({ TableName: ctx.tableName, Key: key, ConsistentRead: true });
  validateMcpSession(item, protocolVersion, now);
  const initializedAt = readOptionalNumber(item, "initializedAt");
  const shouldInitialize = markInitialized && initializedAt === undefined;
  const expressionAttributeNames: Record<string, string> = { "#lastSeenAt": "lastSeenAt", "#terminatedAt": "terminatedAt", "#expiresAt": "expiresAt" };
  if (shouldInitialize) expressionAttributeNames["#initializedAt"] = "initializedAt";
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: key,
      UpdateExpression: shouldInitialize ? "SET #lastSeenAt = :now, #initializedAt = :now" : "SET #lastSeenAt = :now",
      ConditionExpression: "attribute_not_exists(#terminatedAt) AND #expiresAt > :now",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: { ":now": numberAttr(now) },
    });
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) throw notFound();
    throw error;
  }
  return { initialized: initializedAt !== undefined || shouldInitialize };
}

export async function reserveMcpRequestId(ctx: DynamoDbStoreContext, sessionIdHash: string, requestIdHash: string): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reserved = await tryReserveMcpRequestId(ctx, sessionIdHash, requestIdHash);
    if (reserved !== undefined) return reserved;
  }
  throw new ServiceError("server_error", "mcp session update conflict", 500);
}

async function tryReserveMcpRequestId(ctx: DynamoDbStoreContext, sessionIdHash: string, requestIdHash: string): Promise<boolean | undefined> {
  const now = nowSeconds();
  const key = mcpSessionKey(sessionIdHash);
  const item = await ctx.client.getItem({ TableName: ctx.tableName, Key: key, ConsistentRead: true });
  validateMcpSession(item, undefined, now);
  const existingIds = readStringSet(item, "requestIds");
  if (existingIds.includes(requestIdHash)) return false;
  if (existingIds.length >= maxMcpRequestIds) throw new ServiceError("rate_limited", "too many mcp request ids", 429);
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: key,
      UpdateExpression: "SET #lastSeenAt = :now, #requestIds = :requestIds, #requestIdCount = :nextCount",
      ConditionExpression: "attribute_not_exists(#terminatedAt) AND #expiresAt > :now AND #requestIdCount = :currentCount",
      ExpressionAttributeNames: {
        "#lastSeenAt": "lastSeenAt",
        "#requestIds": "requestIds",
        "#requestIdCount": "requestIdCount",
        "#terminatedAt": "terminatedAt",
        "#expiresAt": "expiresAt",
      },
      ExpressionAttributeValues: {
        ":now": numberAttr(now),
        ":requestIds": stringSetAttr([...existingIds, requestIdHash]),
        ":currentCount": numberAttr(existingIds.length),
        ":nextCount": numberAttr(existingIds.length + 1),
      },
    });
    return true;
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) return undefined;
    throw error;
  }
}

export async function terminateMcpSession(ctx: DynamoDbStoreContext, sessionIdHash: string): Promise<void> {
  const now = nowSeconds();
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: mcpSessionKey(sessionIdHash),
      UpdateExpression: "SET #terminatedAt = :now, #lastSeenAt = :now",
      ConditionExpression: "attribute_not_exists(#terminatedAt) AND #expiresAt > :now",
      ExpressionAttributeNames: { "#terminatedAt": "terminatedAt", "#lastSeenAt": "lastSeenAt", "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":now": numberAttr(now) },
    });
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) throw notFound();
    throw error;
  }
}

function validateMcpSession(item: DynamoDbItem | undefined, protocolVersion: string | undefined, now: number): asserts item is DynamoDbItem {
  if (!item || readOptionalNumber(item, "terminatedAt") !== undefined || readNumber(item, "expiresAt") <= now) throw notFound();
  if (protocolVersion !== undefined && readString(item, "protocolVersion") !== protocolVersion) throw new ServiceError("bad_request", "unsupported protocol version", 400);
}

function notFound(): ServiceError {
  return new ServiceError("not_found", "mcp session not found", 404);
}

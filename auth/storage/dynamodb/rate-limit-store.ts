import type { ServiceConfig } from "../../../shared/config.ts";
import type { RateLimitPolicy } from "../../../shared/config.ts";
import { sha256Base64Url } from "../../../shared/crypto.ts";
import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { RateLimitStore } from "../oauth-store.ts";
import { nextRateLimitRecord } from "../rate-limit-algorithm.ts";
import type { RateLimitRecord } from "../store-records.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import type { DynamoDbClient, PutItemInput } from "./client.ts";
import { numberAttr, readNumber, readString } from "./attribute-value.ts";
import { metaItem } from "./item-codec.ts";
import { rateLimitKey } from "./keys.ts";
import { dynamoDbStoreContext } from "./store-context.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

export class DynamoDbRateLimitStore implements RateLimitStore {
  private readonly ctx: DynamoDbStoreContext;

  constructor(config: ServiceConfig, client: DynamoDbClient) {
    this.ctx = dynamoDbStoreContext(config, client);
  }

  async hit(key: string, policy: RateLimitPolicy): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await tryHit(this.ctx, key, policy)) return;
    }
    throw new ServiceError("server_error", "rate limit update conflict", 500);
  }
}

async function tryHit(ctx: DynamoDbStoreContext, key: string, policy: RateLimitPolicy): Promise<boolean> {
  const now = nowSeconds();
  const itemKey = rateLimitKey(sha256Base64Url(key));
  const existing = await ctx.client.getItem({ TableName: ctx.tableName, Key: itemKey, ConsistentRead: true });
  const existingRecord = readRateLimitRecord(existing, now);
  const next = nextRateLimitRecord(existingRecord, policy, now);
  try {
    await ctx.client.putItem({
      TableName: ctx.tableName,
      Item: rateLimitItem(itemKey, next),
      ...putCondition(existingRecord, now),
    });
    return true;
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) return false;
    throw error;
  }
}

function readRateLimitRecord(item: Awaited<ReturnType<DynamoDbClient["getItem"]>>, now: number): RateLimitRecord | undefined {
  if (!item) return undefined;
  const expiresAt = readNumber(item, "expiresAt");
  if (expiresAt <= now) return undefined;
  if (readString(item, "recordType") !== "rate_limit_v2") throw new Error("DynamoDB rate-limit item has unexpected type");
  return {
    windowStart: readNumber(item, "windowStart"),
    previousCount: readNumber(item, "previousCount"),
    currentCount: readNumber(item, "currentCount"),
    expiresAt,
  };
}

function rateLimitItem(key: ReturnType<typeof rateLimitKey>, record: RateLimitRecord) {
  return metaItem(key, "rate_limit_v2", record.expiresAt, {
    windowStart: numberAttr(record.windowStart),
    previousCount: numberAttr(record.previousCount),
    currentCount: numberAttr(record.currentCount),
  });
}

function putCondition(existing: RateLimitRecord | undefined, now: number): Pick<PutItemInput, "ConditionExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"> {
  if (!existing) {
    return {
      ConditionExpression: "attribute_not_exists(pk) OR #expiresAt <= :now",
      ExpressionAttributeNames: { "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":now": numberAttr(now) },
    };
  }
  return {
    ConditionExpression: "#windowStart = :windowStart AND #previousCount = :previousCount AND #currentCount = :currentCount",
    ExpressionAttributeNames: { "#windowStart": "windowStart", "#previousCount": "previousCount", "#currentCount": "currentCount" },
    ExpressionAttributeValues: {
      ":windowStart": numberAttr(existing.windowStart),
      ":previousCount": numberAttr(existing.previousCount),
      ":currentCount": numberAttr(existing.currentCount),
    },
  };
}

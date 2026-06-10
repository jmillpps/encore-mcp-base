import type { ServiceConfig } from "../../../shared/config.ts";
import { sha256Base64Url } from "../../../shared/crypto.ts";
import { ServiceError } from "../../../shared/errors.ts";
import { nowSeconds } from "../../../shared/time.ts";
import type { RateLimitStore } from "../oauth-store.ts";
import { DynamoDbConditionalCheckFailed } from "./client.ts";
import type { DynamoDbClient } from "./client.ts";
import { numberAttr, readNumber } from "./attribute-value.ts";
import { metaItem } from "./item-codec.ts";
import { rateLimitKey } from "./keys.ts";
import { dynamoDbStoreContext } from "./store-context.ts";
import type { DynamoDbStoreContext } from "./store-context.ts";

export class DynamoDbRateLimitStore implements RateLimitStore {
  private readonly ctx: DynamoDbStoreContext;

  constructor(config: ServiceConfig, client: DynamoDbClient) {
    this.ctx = dynamoDbStoreContext(config, client);
  }

  async hit(key: string, windowSeconds: number, maxRequests: number): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await tryHit(this.ctx, key, windowSeconds, maxRequests)) return;
    }
    throw new ServiceError("server_error", "rate limit update conflict", 500);
  }
}

async function tryHit(ctx: DynamoDbStoreContext, key: string, windowSeconds: number, maxRequests: number): Promise<boolean> {
  const now = nowSeconds();
  const itemKey = rateLimitKey(sha256Base64Url(key));
  const existing = await ctx.client.getItem({ TableName: ctx.tableName, Key: itemKey, ConsistentRead: true });
  if (!existing || readNumber(existing, "resetAt") <= now) return resetBucket(ctx, itemKey, now + windowSeconds);
  const count = readNumber(existing, "count");
  if (count >= maxRequests) throw new ServiceError("rate_limited", "rate limit exceeded", 429);
  try {
    await ctx.client.updateItem({
      TableName: ctx.tableName,
      Key: itemKey,
      UpdateExpression: "SET #count = :nextCount",
      ConditionExpression: "#resetAt > :now AND #count = :currentCount",
      ExpressionAttributeNames: { "#count": "count", "#resetAt": "resetAt" },
      ExpressionAttributeValues: {
        ":now": numberAttr(now),
        ":currentCount": numberAttr(count),
        ":nextCount": numberAttr(count + 1),
      },
    });
    return true;
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) return false;
    throw error;
  }
}

async function resetBucket(ctx: DynamoDbStoreContext, key: ReturnType<typeof rateLimitKey>, resetAt: number): Promise<boolean> {
  try {
    await ctx.client.putItem({
      TableName: ctx.tableName,
      Item: metaItem(key, "rate_limit", resetAt, { count: numberAttr(1), resetAt: numberAttr(resetAt) }),
      ConditionExpression: "attribute_not_exists(pk) OR #resetAt <= :now",
      ExpressionAttributeNames: { "#resetAt": "resetAt" },
      ExpressionAttributeValues: { ":now": numberAttr(nowSeconds()) },
    });
    return true;
  } catch (error) {
    if (error instanceof DynamoDbConditionalCheckFailed) return false;
    throw error;
  }
}

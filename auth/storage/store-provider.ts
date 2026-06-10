import type { ServiceConfig } from "../../shared/config.ts";
import { DiskOAuthStore } from "./disk-store.ts";
import { DynamoDbHttpClient } from "./dynamodb/http-client.ts";
import { DynamoDbOAuthStore } from "./dynamodb/oauth-store.ts";
import { DynamoDbRateLimitStore } from "./dynamodb/rate-limit-store.ts";
import type { OAuthStore, RateLimitStore } from "./oauth-store.ts";
import { DiskRateLimitStore } from "./rate-limit-store.ts";

interface DynamoDbStoreBundle {
  oauth: OAuthStore;
  rateLimit: RateLimitStore;
}

const dynamoDbStoreBundles = new Map<string, DynamoDbStoreBundle>();

export function oauthStore(config: ServiceConfig): OAuthStore {
  if (config.oauthStoreBackend === "dynamodb") return dynamoDbStoreBundle(config).oauth;
  return new DiskOAuthStore(config.oauthStorePath);
}

export function rateLimitStore(config: ServiceConfig): RateLimitStore {
  if (config.oauthStoreBackend === "dynamodb") return dynamoDbStoreBundle(config).rateLimit;
  return new DiskRateLimitStore(config.oauthStorePath);
}

function dynamoDbStoreBundle(config: ServiceConfig): DynamoDbStoreBundle {
  const cacheKey = dynamoDbStoreCacheKey(config.oauthDynamoDb);
  const cached = dynamoDbStoreBundles.get(cacheKey);
  if (cached) return cached;
  const client = new DynamoDbHttpClient(config.oauthDynamoDb);
  const bundle = {
    oauth: new DynamoDbOAuthStore(config, client),
    rateLimit: new DynamoDbRateLimitStore(config, client),
  };
  dynamoDbStoreBundles.set(cacheKey, bundle);
  return bundle;
}

function dynamoDbStoreCacheKey(config: ServiceConfig["oauthDynamoDb"]): string {
  return JSON.stringify([config.tableName, config.region, config.endpoint ?? ""]);
}

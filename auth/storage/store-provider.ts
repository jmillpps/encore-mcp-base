import type { ServiceConfig } from "../../shared/config.ts";
import { DiskOAuthStore } from "./disk-store.ts";
import { DynamoDbHttpClient } from "./dynamodb/http-client.ts";
import { DynamoDbMetadataCacheStore } from "./dynamodb/metadata-cache-store.ts";
import { DynamoDbOAuthStore } from "./dynamodb/oauth-store.ts";
import { DynamoDbRateLimitStore } from "./dynamodb/rate-limit-store.ts";
import type { MetadataCacheStore } from "./metadata-cache-store.ts";
import type { OAuthStore, RateLimitStore } from "./oauth-store.ts";
import { DiskRateLimitStore } from "./rate-limit-store.ts";

interface DynamoDbStoreBundle {
  oauth: OAuthStore;
  rateLimit: RateLimitStore;
  metadataCache: MetadataCacheStore;
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

export function metadataCacheStore(config: ServiceConfig): MetadataCacheStore | undefined {
  if (config.oauthStoreBackend === "dynamodb") return dynamoDbStoreBundle(config).metadataCache;
  return undefined;
}

function dynamoDbStoreBundle(config: ServiceConfig): DynamoDbStoreBundle {
  const cacheKey = dynamoDbStoreCacheKey(config.oauthDynamoDb);
  const cached = dynamoDbStoreBundles.get(cacheKey);
  if (cached) return cached;
  const client = new DynamoDbHttpClient(config.oauthDynamoDb);
  const bundle = {
    oauth: new DynamoDbOAuthStore(config, client),
    rateLimit: new DynamoDbRateLimitStore(config, client),
    metadataCache: new DynamoDbMetadataCacheStore(config, client),
  };
  dynamoDbStoreBundles.set(cacheKey, bundle);
  return bundle;
}

function dynamoDbStoreCacheKey(config: ServiceConfig["oauthDynamoDb"]): string {
  return JSON.stringify([config.tableName, config.region, config.endpoint ?? ""]);
}

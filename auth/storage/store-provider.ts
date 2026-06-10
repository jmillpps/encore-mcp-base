import type { ServiceConfig } from "../../shared/config.ts";
import { DiskOAuthStore } from "./disk-store.ts";
import { DynamoDbHttpClient } from "./dynamodb/http-client.ts";
import { DynamoDbOAuthStore } from "./dynamodb/oauth-store.ts";
import { DynamoDbRateLimitStore } from "./dynamodb/rate-limit-store.ts";
import type { OAuthStore, RateLimitStore } from "./oauth-store.ts";
import { DiskRateLimitStore } from "./rate-limit-store.ts";

export function oauthStore(config: ServiceConfig): OAuthStore {
  if (config.oauthStoreBackend === "dynamodb") return new DynamoDbOAuthStore(config, new DynamoDbHttpClient(config.oauthDynamoDb));
  return new DiskOAuthStore(config.oauthStorePath);
}

export function rateLimitStore(config: ServiceConfig): RateLimitStore {
  if (config.oauthStoreBackend === "dynamodb") return new DynamoDbRateLimitStore(config, new DynamoDbHttpClient(config.oauthDynamoDb));
  return new DiskRateLimitStore(config.oauthStorePath);
}

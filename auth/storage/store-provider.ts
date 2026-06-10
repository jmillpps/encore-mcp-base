import type { ServiceConfig } from "../../shared/config.ts";
import { DiskOAuthStore } from "./disk-store.ts";
import type { OAuthStore, RateLimitStore } from "./oauth-store.ts";
import { DiskRateLimitStore } from "./rate-limit-store.ts";

export function oauthStore(config: ServiceConfig): OAuthStore {
  return new DiskOAuthStore(config.oauthStorePath);
}

export function rateLimitStore(config: ServiceConfig): RateLimitStore {
  return new DiskRateLimitStore(config.oauthStorePath);
}

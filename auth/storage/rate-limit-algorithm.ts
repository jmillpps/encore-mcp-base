import type { RateLimitPolicy } from "../../shared/config.ts";
import { ServiceError } from "../../shared/errors.ts";
import type { RateLimitRecord } from "./store-records.ts";

export function nextRateLimitRecord(existing: RateLimitRecord | undefined, policy: RateLimitPolicy, now: number): RateLimitRecord {
  const windowStart = Math.floor(now / policy.windowSeconds) * policy.windowSeconds;
  const current = countersForWindow(existing, windowStart, policy.windowSeconds, now);
  const elapsed = now - windowStart;
  const weightedPrevious = current.previousCount * ((policy.windowSeconds - elapsed) / policy.windowSeconds);
  if (current.currentCount + weightedPrevious >= policy.maxRequests) throw new ServiceError("rate_limited", "rate limit exceeded", 429);
  return {
    windowStart,
    previousCount: current.previousCount,
    currentCount: current.currentCount + 1,
    expiresAt: windowStart + policy.windowSeconds * 2,
  };
}

function countersForWindow(existing: RateLimitRecord | undefined, windowStart: number, windowSeconds: number, now: number): { previousCount: number; currentCount: number } {
  if (!existing || existing.expiresAt <= now) return { previousCount: 0, currentCount: 0 };
  if (existing.windowStart === windowStart) return { previousCount: existing.previousCount, currentCount: existing.currentCount };
  if (existing.windowStart === windowStart - windowSeconds) return { previousCount: existing.currentCount, currentCount: 0 };
  return { previousCount: 0, currentCount: 0 };
}

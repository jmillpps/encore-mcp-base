export type RateLimitBucket = "oauth-authorize" | "oauth-token" | "oauth-userinfo" | "mcp-tool" | "mcp-resource";

export interface RateLimitPolicy {
  windowSeconds: number;
  maxRequests: number;
}

const rateLimitBuckets = ["oauth-authorize", "oauth-token", "oauth-userinfo", "mcp-tool", "mcp-resource"] as const satisfies readonly RateLimitBucket[];

export function readRateLimitPolicies(env: NodeJS.ProcessEnv, defaults: RateLimitPolicy): Record<RateLimitBucket, RateLimitPolicy> {
  const policies = Object.fromEntries(rateLimitBuckets.map((bucket) => [bucket, { ...defaults }])) as Record<RateLimitBucket, RateLimitPolicy>;
  const value = env.RATE_LIMIT_POLICIES_JSON;
  if (value === undefined) return policies;
  const parsed = jsonObject(value, "RATE_LIMIT_POLICIES_JSON");
  for (const [bucket, policyValue] of Object.entries(parsed)) {
    if (!rateLimitBuckets.includes(bucket as RateLimitBucket)) throw new Error("RATE_LIMIT_POLICIES_JSON contains unknown bucket");
    const policy = jsonObject(policyValue, `RATE_LIMIT_POLICIES_JSON.${bucket}`);
    const windowSeconds = optionalPositiveInteger(policy.windowSeconds, `RATE_LIMIT_POLICIES_JSON.${bucket}.windowSeconds`) ?? defaults.windowSeconds;
    const maxRequests = optionalPositiveInteger(policy.maxRequests, `RATE_LIMIT_POLICIES_JSON.${bucket}.maxRequests`) ?? defaults.maxRequests;
    policies[bucket as RateLimitBucket] = { windowSeconds, maxRequests };
  }
  return policies;
}

function jsonObject(value: unknown, name: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${name} must be valid JSON`);
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object`);
  return parsed as Record<string, unknown>;
}

function optionalPositiveInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
  return value;
}

import { ServiceError } from "../shared/errors.ts";

export function assertAllowedParameters(params: URLSearchParams, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of new Set(params.keys())) {
    if (!allowedSet.has(key)) throw new ServiceError("bad_request", "unsupported oauth parameter", 400);
    if (params.getAll(key).length > 1) throw new ServiceError("bad_request", "duplicate oauth parameter", 400);
  }
}

export function requiredParameter(params: URLSearchParams, key: string): string {
  const value = optionalParameter(params, key);
  if (!value) throw new ServiceError("bad_request", `${key} is required`, 400);
  return value;
}

export function optionalParameter(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  if (values.length > 1) throw new ServiceError("bad_request", "duplicate oauth parameter", 400);
  return values[0] ?? undefined;
}

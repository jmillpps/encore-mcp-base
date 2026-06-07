import { ServiceError } from "../shared/errors.ts";

export const authSessionScopes = ["openid"] as const;
export const identityProfileScopes = ["openid", "profile", "email"] as const;
export const defaultScopes = identityProfileScopes;
const scopeListPattern = /^[A-Za-z0-9:_./-]+(?: [A-Za-z0-9:_./-]+)*$/;

export function mcpProtectedResourceScopes(): string[] {
  return [...new Set([...authSessionScopes, ...identityProfileScopes])];
}

export function parseScopes(input: string | undefined): string[] {
  if (input === undefined) return [...defaultScopes];
  if (!scopeListPattern.test(input)) throw new ServiceError("invalid_scope", "scope is invalid", 400);
  return [...new Set(input.split(" "))];
}

export function assertAllowedScopes(requested: string[], allowed: readonly string[]): void {
  const denied = requested.filter((scope) => !allowed.includes(scope));
  if (denied.length > 0) throw new ServiceError("invalid_scope", "requested scope is not allowed", 400);
}

export function hasScopes(actual: readonly string[], required: readonly string[]): boolean {
  return required.every((scope) => actual.includes(scope));
}

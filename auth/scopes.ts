import { ServiceError } from "../shared/errors.ts";

export const defaultScopes = ["openid", "profile", "email"] as const;

export function parseScopes(input: string | undefined): string[] {
  const raw = input?.trim() ? input : defaultScopes.join(" ");
  return [...new Set(raw.split(/\s+/).map((scope) => scope.trim()).filter(Boolean))].sort();
}

export function assertAllowedScopes(requested: string[], allowed: readonly string[]): void {
  const denied = requested.filter((scope) => !allowed.includes(scope));
  if (denied.length > 0) throw new ServiceError("invalid_scope", "requested scope is not allowed", 400);
}

export function hasScopes(actual: readonly string[], required: readonly string[]): boolean {
  return required.every((scope) => actual.includes(scope));
}

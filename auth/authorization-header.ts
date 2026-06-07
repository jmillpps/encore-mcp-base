import type { IncomingMessage } from "node:http";
import { ServiceError, type ErrorCode } from "../shared/errors.ts";

type HeaderMap = Record<string, string | string[] | undefined>;

interface AuthorizationError {
  code: ErrorCode;
  message: string;
  status: number;
}

export function readAuthorizationCredentials(header: string | undefined, scheme: string, error: AuthorizationError): string {
  const credentials = authorizationCredentials(header, scheme);
  if (credentials === undefined) fail(error);
  return credentials;
}

export function authorizationCredentials(header: string | undefined, scheme: string): string | undefined {
  if (!header) return undefined;
  const match = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[ \t]+(.+)$/.exec(header);
  if (!match) return undefined;
  const receivedScheme = match[1];
  const receivedCredentials = match[2];
  if (receivedScheme === undefined || receivedCredentials === undefined || receivedScheme.toLowerCase() !== scheme.toLowerCase()) return undefined;
  const credentials = receivedCredentials.trim();
  if (!credentials) return undefined;
  return credentials;
}

export function validateSingleAuthorizationHeader(req: IncomingMessage): void {
  if (duplicateRawAuthorizationHeader(req.rawHeaders)) throw new ServiceError("bad_request", "duplicate authorization header", 400);
}

export function hasMultipleAuthorizationValues(headers: HeaderMap): boolean {
  const value = headerValue(headers, "authorization");
  return Array.isArray(value) && value.length > 1;
}

function duplicateRawAuthorizationHeader(rawHeaders: readonly string[]): boolean {
  let count = 0;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === "authorization") count += 1;
  }
  return count > 1;
}

function headerValue(headers: HeaderMap, name: string): string | string[] | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

function fail(error: AuthorizationError): never {
  throw new ServiceError(error.code, error.message, error.status);
}

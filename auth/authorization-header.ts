import { ServiceError, type ErrorCode } from "../shared/errors.ts";

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

function fail(error: AuthorizationError): never {
  throw new ServiceError(error.code, error.message, error.status);
}

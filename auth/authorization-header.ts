import { ServiceError, type ErrorCode } from "../shared/errors.ts";

interface AuthorizationError {
  code: ErrorCode;
  message: string;
  status: number;
}

export function readAuthorizationCredentials(header: string | undefined, scheme: string, error: AuthorizationError): string {
  if (!header) fail(error);
  const match = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[ \t]+(.+)$/.exec(header);
  if (!match) fail(error);
  const receivedScheme = match[1];
  const receivedCredentials = match[2];
  if (receivedScheme === undefined || receivedCredentials === undefined || receivedScheme.toLowerCase() !== scheme.toLowerCase()) fail(error);
  const credentials = receivedCredentials.trim();
  if (!credentials) fail(error);
  return credentials;
}

function fail(error: AuthorizationError): never {
  throw new ServiceError(error.code, error.message, error.status);
}

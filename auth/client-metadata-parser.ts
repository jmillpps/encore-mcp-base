import type { ServiceConfig } from "../shared/config.ts";
import { invalidMetadataClient } from "./client-metadata-error.ts";
import { parseClientIdUrl } from "./client-metadata-network.ts";
import type { OAuthClient, TokenEndpointAuthMethod } from "./client-types.ts";
import { defaultScopes } from "./scopes.ts";

export function parseMetadataClient(config: ServiceConfig, clientId: string, body: unknown): OAuthClient {
  const record = metadataRecord(body);
  const documentClientId = requiredString(record, "client_id");
  if (documentClientId !== clientId) throw invalidMetadataClient();
  const displayName = requiredString(record, "client_name");
  const redirectUris = requiredStringArray(record, "redirect_uris").map((redirectUri) => validRedirectUri(redirectUri, config.production));
  validateOptionalString(record, "client_uri");
  validateOptionalString(record, "logo_uri");
  validateGrantTypes(record);
  validateResponseTypes(record);
  const tokenAuth = tokenEndpointAuth(config, clientId, record);
  return {
    clientId,
    displayName,
    redirectUris: rejectDuplicates(redirectUris),
    allowedScopes: [...defaultScopes],
    allowedResources: [config.mcpResource],
    tokenEndpointAuthMethod: tokenAuth.method,
    ...(tokenAuth.jwksUri ? { jwksUri: tokenAuth.jwksUri } : {}),
    pkcePolicy: "required",
    clientClass: "client-id-metadata-document",
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidMetadataClient();
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") throw invalidMetadataClient();
  return value;
}

function validateOptionalString(record: Record<string, unknown>, key: string): void {
  const value = record[key];
  if (value !== undefined && (typeof value !== "string" || value.trim() === "")) throw invalidMetadataClient();
}

function requiredStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw invalidMetadataClient();
  }
  return value;
}

function validateGrantTypes(record: Record<string, unknown>): void {
  const value = record.grant_types;
  if (value === undefined) return;
  const grantTypes = optionalStringArray(value);
  if (!grantTypes.includes("authorization_code")) throw invalidMetadataClient();
}

function validateResponseTypes(record: Record<string, unknown>): void {
  const value = record.response_types;
  if (value === undefined) return;
  const responseTypes = optionalStringArray(value);
  if (!responseTypes.includes("code")) throw invalidMetadataClient();
}

function tokenEndpointAuth(config: ServiceConfig, clientId: string, record: Record<string, unknown>): { method: TokenEndpointAuthMethod; jwksUri?: string } {
  const value = record.token_endpoint_auth_method;
  if (value === undefined || value === "none") return { method: "none" };
  if (value === "private_key_jwt") return { method: "private_key_jwt", jwksUri: validatedJwksUri(config, clientId, record) };
  throw invalidMetadataClient();
}

function validatedJwksUri(config: ServiceConfig, clientId: string, record: Record<string, unknown>): string {
  const jwksUri = requiredString(record, "jwks_uri");
  const clientUrl = parseClientIdUrl(clientId, config.production);
  const jwksUrl = parseClientIdUrl(jwksUri, config.production);
  if (jwksUrl.origin !== clientUrl.origin) throw invalidMetadataClient();
  return jwksUrl.href;
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw invalidMetadataClient();
  }
  return value;
}

function validRedirectUri(value: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidMetadataClient();
  }
  if (value !== value.trim()) throw invalidMetadataClient();
  if (value.includes("*")) throw invalidMetadataClient();
  if (url.username || url.password || url.hash) throw invalidMetadataClient();
  if (production && url.protocol !== "https:") throw invalidMetadataClient();
  if (url.protocol !== "https:" && url.protocol !== "http:") throw invalidMetadataClient();
  return value;
}

function rejectDuplicates(values: string[]): string[] {
  if (new Set(values).size !== values.length) throw invalidMetadataClient();
  return values;
}

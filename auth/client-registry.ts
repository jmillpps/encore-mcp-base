import type { OAuthClient } from "./client-types.ts";
import { isDisplayName } from "./display-name.ts";
import { parseRedirectUri, productionRedirectUriAllowed } from "./redirect-uri.ts";

const authMethods = ["client_secret_post", "client_secret_basic"] as const;
const pkcePolicies = ["required", "optional"] as const;
const clientKeys = ["clientId", "clientSecretHash", "displayName", "redirectUris", "allowedScopes", "allowedResources", "tokenEndpointAuthMethod", "pkcePolicy", "clientClass"] as const;
const identifierPattern = /^[A-Za-z0-9._:-]+$/;
const scopePattern = /^[A-Za-z0-9:_./-]+$/;
const sha256Base64UrlPattern = /^[A-Za-z0-9_-]{43}$/;

export function parseClientJson(value: string, production: boolean): OAuthClient[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("OAUTH_CLIENTS_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("OAUTH_CLIENTS_JSON must be a non-empty array");
  const clients = parsed.map((entry, index) => parseClient(entry, index, production));
  rejectDuplicates(clients.map((client) => client.clientId), "clientId");
  return clients;
}

function parseClient(value: unknown, index: number, production: boolean): OAuthClient {
  const record = objectRecord(value, `client ${index}`, clientKeys);
  const tokenEndpointAuthMethod = oneOf(readString(record, "tokenEndpointAuthMethod"), authMethods, "tokenEndpointAuthMethod");
  const pkcePolicy = oneOf(readString(record, "pkcePolicy"), pkcePolicies, "pkcePolicy");
  if (production && pkcePolicy !== "required") throw new Error("PKCE is required for production clients");
  return {
    clientId: identifier(readString(record, "clientId"), "clientId"),
    clientSecretHash: secretHash(readString(record, "clientSecretHash")),
    displayName: displayName(readString(record, "displayName")),
    redirectUris: redirectUrls(readStringArray(record, "redirectUris"), production),
    allowedScopes: scopes(readStringArray(record, "allowedScopes")),
    allowedResources: resourceUrls(readStringArray(record, "allowedResources"), production),
    tokenEndpointAuthMethod,
    pkcePolicy,
    clientClass: identifier(readString(record, "clientClass"), "clientClass"),
  };
}

function objectRecord(value: unknown, name: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) throw new Error(`${name} contains unsupported fields`);
  return record;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${key} must be a non-empty string`);
  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(`${key} must be a non-empty string array`);
  }
  return rejectDuplicates(value, key);
}

function identifier(value: string, key: string): string {
  if (!identifierPattern.test(value)) throw new Error(`${key} contains invalid characters`);
  return value;
}

function secretHash(value: string): string {
  if (!sha256Base64UrlPattern.test(value)) throw new Error("clientSecretHash must be a SHA-256 base64url hash");
  return value;
}

function displayName(value: string): string {
  if (!isDisplayName(value)) throw new Error("displayName contains invalid characters");
  return value;
}

function redirectUrls(values: string[], production: boolean): string[] {
  return rejectDuplicates(values.map((value) => parseRedirectUrl(value, production)), "redirectUris");
}

function resourceUrls(values: string[], production: boolean): string[] {
  return rejectDuplicates(values.map((value) => parseHttpUrl(value, "allowedResources", production).href.replace(/\/$/, "")), "allowedResources");
}

function parseHttpUrl(value: string, key: string, production: boolean): URL {
  if (value !== value.trim()) throw new Error(`${key} cannot include surrounding whitespace`);
  if (value.includes("*")) throw new Error(`${key} cannot contain wildcards`);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${key} must use http or https`);
  if (production && url.protocol !== "https:") throw new Error(`${key} must use https in production`);
  if (url.username || url.password) throw new Error(`${key} cannot include credentials`);
  if (url.hash) throw new Error(`${key} cannot include fragments`);
  return url;
}

function parseRedirectUrl(value: string, production: boolean): string {
  const url = parseRedirectUri(value, "redirectUris");
  if (production && !productionRedirectUriAllowed(url)) throw new Error("redirectUris must use https or localhost http in production");
  return value;
}

function scopes(values: string[]): string[] {
  return values.map((value) => {
    if (!scopePattern.test(value)) throw new Error("allowedScopes contains invalid characters");
    return value;
  });
}

function oneOf<T extends readonly string[]>(value: string, allowed: T, key: string): T[number] {
  if (!allowed.includes(value)) throw new Error(`${key} is not supported`);
  return value as T[number];
}

function rejectDuplicates(values: string[], key: string): string[] {
  if (new Set(values).size !== values.length) throw new Error(`${key} contains duplicates`);
  return values;
}

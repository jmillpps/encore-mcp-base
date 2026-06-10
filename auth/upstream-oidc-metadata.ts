import type { ServiceConfig, UpstreamOidcConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { supportedAlgorithms, type JwksDocument, type JwsAlgorithm } from "./upstream-oidc-jwt.ts";

export interface UpstreamProviderMetadata {
  issuer: string;
  jwksUri: string;
  idTokenAlgorithms: JwsAlgorithm[];
  userinfoAlgorithms: JwsAlgorithm[];
}

export async function fetchUpstreamProviderMetadata(config: ServiceConfig): Promise<UpstreamProviderMetadata> {
  const payload = await fetchJsonObject(config.upstreamOidc.discoveryUrl);
  const issuer = requiredString(payload, "issuer");
  if (issuer !== config.upstreamOidc.issuer) throw invalidGrant("upstream discovery issuer is invalid");
  assertEndpoint(payload, "authorization_endpoint", config.upstreamOidc.authorizationUrl);
  assertEndpoint(payload, "token_endpoint", config.upstreamOidc.tokenUrl);
  assertEndpoint(payload, "userinfo_endpoint", config.upstreamOidc.userinfoUrl);
  const jwksUri = upstreamUrl(requiredString(payload, "jwks_uri"), "jwks_uri", config.production);
  return {
    issuer,
    jwksUri,
    idTokenAlgorithms: supportedAlgorithms(payload.id_token_signing_alg_values_supported),
    userinfoAlgorithms: optionalAlgorithms(payload.userinfo_signing_alg_values_supported),
  };
}

export async function fetchUpstreamJwks(metadata: UpstreamProviderMetadata, production: boolean): Promise<JwksDocument> {
  upstreamUrl(metadata.jwksUri, "jwks_uri", production);
  const payload = await fetchJsonObject(metadata.jwksUri);
  if (!Array.isArray(payload.keys)) throw invalidGrant("upstream JWKS response is invalid");
  return { keys: payload.keys.filter((key): key is Record<string, unknown> => typeof key === "object" && key !== null && !Array.isArray(key)) };
}

function optionalAlgorithms(value: unknown): JwsAlgorithm[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidGrant("upstream discovery response is invalid");
  return value.filter((entry): entry is JwsAlgorithm => typeof entry === "string" && entry !== "none").flatMap((entry) => {
    try {
      return supportedAlgorithms([entry]);
    } catch {
      return [];
    }
  });
}

async function fetchJsonObject(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  const payload = await readJsonObject(response);
  if (!response.ok) throw invalidGrant("upstream metadata request failed");
  return payload;
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidGrant("upstream metadata response is invalid");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw invalidGrant("upstream metadata response is invalid");
  return payload as Record<string, unknown>;
}

function assertEndpoint(payload: Record<string, unknown>, key: string, expected: string): void {
  const value = requiredString(payload, key);
  if (value !== expected) throw invalidGrant(`upstream ${key} is invalid`);
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") throw invalidGrant("upstream discovery response is invalid");
  return value;
}

function upstreamUrl(value: string, key: string, production: boolean): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw invalidGrant(`upstream ${key} is invalid`);
  if (production && url.protocol !== "https:") throw invalidGrant(`upstream ${key} must use https`);
  if (url.username || url.password || url.hash) throw invalidGrant(`upstream ${key} is invalid`);
  return url.href.replace(/\/$/, "");
}

function invalidGrant(message: string): ServiceError {
  return new ServiceError("invalid_grant", message, 400);
}

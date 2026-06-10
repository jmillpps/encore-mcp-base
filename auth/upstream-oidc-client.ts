import type { ServiceConfig, UpstreamOidcConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import type { UserProfile } from "./user-profile.ts";
import { validateUpstreamIdToken, validateUpstreamUserinfo } from "./upstream-oidc-claims.ts";
import { fetchUpstreamJwks, fetchUpstreamProviderMetadata, type UpstreamProviderMetadata } from "./upstream-oidc-metadata.ts";
import { isCompactJwt, verifyJwt, type JwksDocument } from "./upstream-oidc-jwt.ts";

interface TokenResponse {
  access_token: string;
  token_type: string;
  id_token: string;
}

export async function exchangeUpstreamCode(config: ServiceConfig, code: string, codeVerifier: string, upstreamNonce: string): Promise<UserProfile> {
  const metadata = await fetchUpstreamProviderMetadata(config);
  const jwks = await fetchUpstreamJwks(metadata, config.production);
  const tokens = await tokenRequest(config.upstreamOidc, code, codeVerifier);
  const idToken = verifyJwt(tokens.id_token, jwks, metadata.idTokenAlgorithms);
  const identity = validateUpstreamIdToken(config, idToken.payload, idToken.header.alg, upstreamNonce, tokens.access_token);
  return userinfoRequest(config, metadata, jwks, tokens.access_token, identity.sub);
}

async function tokenRequest(config: UpstreamOidcConfig, code: string, codeVerifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (config.tokenEndpointAuthMethod === "client_secret_post") {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
  } else {
    headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString("base64")}`;
  }
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });
  const payload = await readJsonObject(response);
  if (!response.ok) throw new ServiceError("invalid_grant", "upstream token exchange failed", 400);
  const accessToken = payload.access_token;
  const tokenType = payload.token_type;
  const idToken = payload.id_token;
  if (typeof accessToken !== "string" || accessToken.trim() === "") throw new ServiceError("invalid_grant", "upstream token response is invalid", 400);
  if (typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer") throw new ServiceError("invalid_grant", "upstream token response is invalid", 400);
  if (typeof idToken !== "string" || idToken.trim() === "") throw new ServiceError("invalid_grant", "upstream token response is invalid", 400);
  return { access_token: accessToken, token_type: tokenType, id_token: idToken };
}

async function userinfoRequest(config: ServiceConfig, metadata: UpstreamProviderMetadata, jwks: JwksDocument, accessToken: string, idTokenSubject: string): Promise<UserProfile> {
  const response = await fetch(config.upstreamOidc.userinfoUrl, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json, application/jwt" },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  if (!response.ok) throw new ServiceError("invalid_grant", "upstream userinfo request failed", 400);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.split(";")[0]?.trim().toLowerCase() === "application/jwt" || isCompactJwt(body.trim())) {
    if (metadata.userinfoAlgorithms.length === 0) throw new ServiceError("invalid_grant", "upstream signed userinfo is unsupported", 400);
    const jwt = verifyJwt(body.trim(), jwks, metadata.userinfoAlgorithms);
    return validateUpstreamUserinfo(config, jwt.payload, idTokenSubject, true);
  }
  return validateUpstreamUserinfo(config, jsonObject(body), idTokenSubject, false);
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ServiceError("invalid_grant", "upstream response is invalid", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ServiceError("invalid_grant", "upstream response is invalid", 400);
  }
  return payload as Record<string, unknown>;
}

function jsonObject(body: string): Record<string, unknown> {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ServiceError("invalid_grant", "upstream userinfo response is invalid", 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ServiceError("invalid_grant", "upstream userinfo response is invalid", 400);
  }
  return payload as Record<string, unknown>;
}

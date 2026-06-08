import type { UpstreamOidcConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { userProfileFromUpstream, type UserProfile } from "./user-profile.ts";

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export async function exchangeUpstreamCode(config: UpstreamOidcConfig, code: string, codeVerifier: string): Promise<UserProfile> {
  const tokens = await tokenRequest(config, code, codeVerifier);
  return userinfoRequest(config, tokens.access_token);
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
  if (typeof accessToken !== "string" || accessToken.trim() === "") throw new ServiceError("invalid_grant", "upstream token response is invalid", 400);
  if (typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer") throw new ServiceError("invalid_grant", "upstream token response is invalid", 400);
  return { access_token: accessToken, token_type: tokenType };
}

async function userinfoRequest(config: UpstreamOidcConfig, accessToken: string): Promise<UserProfile> {
  const response = await fetch(config.userinfoUrl, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await readJsonObject(response);
  if (!response.ok) throw new ServiceError("invalid_grant", "upstream userinfo request failed", 400);
  try {
    return userProfileFromUpstream(payload);
  } catch {
    throw new ServiceError("invalid_grant", "upstream userinfo response is invalid", 400);
  }
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

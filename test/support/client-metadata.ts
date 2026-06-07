import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as oauth from "oauth4webapi";
import { discover } from "./oauth-client.ts";
import { requireString } from "./http.ts";
import type { TestService } from "./service-process.ts";

export interface MetadataServer {
  clientId: string;
  redirectUri: string;
}

export interface PrivateKeyMetadataServer extends MetadataServer {
  privateKey: oauth.CryptoKey;
  kid: string;
}

interface MetadataServerOptions {
  clientIdOverride?: string;
  tokenEndpointAuthMethod?: string;
  jwks?: Record<string, unknown>;
  jwksUriOverride?: string;
}

export async function startMetadataServer(t: TestContextLike, resource: string, options: MetadataServerOptions = {}): Promise<MetadataServer> {
  let clientId = "";
  let redirectUri = "";
  const server = createServer((req, res) => {
    if (req.url === "/jwks.json" && options.jwks) {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(options.jwks));
      return;
    }
    if (req.url !== "/client.json") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      client_id: options.clientIdOverride ?? clientId,
      client_name: "Metadata Test Client",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: options.tokenEndpointAuthMethod ?? "none",
      ...(options.jwks || options.jwksUriOverride ? { jwks_uri: options.jwksUriOverride ?? `${new URL(clientId).origin}/jwks.json` } : {}),
      resource,
    }));
  });
  await listen(server);
  const address = server.address();
  assertAddressInfo(address);
  clientId = `http://127.0.0.1:${address.port}/client.json`;
  redirectUri = `http://127.0.0.1:${address.port}/callback`;
  t.after(async () => close(server));
  return { clientId, redirectUri };
}

export async function startPrivateKeyMetadataServer(t: TestContextLike, resource: string): Promise<PrivateKeyMetadataServer> {
  const key = await generatePrivateKeyJwtKey("metadata-key");
  const metadata = await startMetadataServer(t, resource, { tokenEndpointAuthMethod: "private_key_jwt", jwks: { keys: [key.publicJwk] } });
  return { ...metadata, privateKey: key.privateKey, kid: key.kid };
}

export async function generatePrivateKeyJwtKey(kid: string): Promise<{ privateKey: oauth.CryptoKey; publicJwk: Record<string, unknown>; kid: string }> {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey as oauth.CryptoKey,
    publicJwk: {
      kty: publicJwk.kty,
      n: publicJwk.n,
      e: publicJwk.e,
      kid,
      alg: "RS256",
      use: "sig",
    },
    kid,
  };
}

export async function authorizeMetadataDocumentClient(
  service: TestService,
  clientId: string,
  redirectUri: string,
): Promise<{ as: oauth.AuthorizationServer; callbackParameters: URLSearchParams; codeVerifier: string }> {
  const as = await discover(service);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const response = await fetchAuthorizationUrl(service, clientId, redirectUri, state, codeChallenge);
  assert.equal(response.status, 302);
  const callback = new URL(requireString(response.headers.get("location"), "location"));
  return {
    as,
    callbackParameters: oauth.validateAuthResponse(as, { client_id: clientId }, callback, state),
    codeVerifier,
  };
}

export async function fetchAuthorizationUrl(
  service: TestService,
  clientId: string,
  redirectUri: string,
  state = oauth.generateRandomState(),
  codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
): Promise<Response> {
  const as = await discover(service);
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", service.mcpResource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return fetch(url, { redirect: "manual" });
}

async function listen(server: Server): Promise<void> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

interface TestContextLike {
  after(fn: () => Promise<void>): void;
}

function assertAddressInfo(value: string | AddressInfo | null): asserts value is AddressInfo {
  assert.equal(typeof value, "object");
  assert.ok(value);
}

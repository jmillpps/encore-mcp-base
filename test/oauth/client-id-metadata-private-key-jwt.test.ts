import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, randomUUID, webcrypto, type KeyObject } from "node:crypto";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { encodeBase64Url, encodeJsonBase64Url } from "../../shared/base64url.ts";
import { callTool, initializeMcp, bearer } from "../support/mcp.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import {
  authorizeMetadataDocumentClient,
  fetchAuthorizationUrl,
  generatePrivateKeyJwtKey,
  startMetadataServer,
  startPrivateKeyMetadataServer,
} from "../support/client-metadata.ts";

test("metadata document private_key_jwt clients complete OAuth with signed client assertions", async (t) => {
  const service = await startService(t);
  const metadata = await startPrivateKeyMetadataServer(t, service.mcpResource);
  const sessionId = await initializeMcp(service);
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.PrivateKeyJwt({ key: metadata.privateKey, kid: metadata.kid }),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: metadata.clientId }, tokenResponse, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  const profile = await callTool(service, sessionId, "identity.profile", bearer(tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, "jmiller@inifnitedevlab.com");
});

test("metadata document private_key_jwt rejects invalid client assertions without consuming the code", async (t) => {
  const service = await startService(t);
  const metadata = await startPrivateKeyMetadataServer(t, service.mcpResource);
  const wrongKey = await generatePrivateKeyJwtKey(metadata.kid);
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const rejected = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.PrivateKeyJwt({ key: wrongKey.privateKey, kid: metadata.kid }),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  assert.equal(rejected.status, 401);
  assert.equal((await readJson(rejected)).error, "invalid_client");
  const accepted = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.PrivateKeyJwt({ key: metadata.privateKey, kid: metadata.kid }),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: metadata.clientId }, accepted, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  assert.ok(tokens.access_token);
});

test("metadata document private_key_jwt rejects replayed client assertions without rotating refresh tokens", async (t) => {
  const service = await startService(t);
  const metadata = await startPrivateKeyMetadataServer(t, service.mcpResource);
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const captured: { assertion?: string } = {};
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    capturingPrivateKeyJwt(metadata, captured),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: metadata.clientId }, tokenResponse, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  const refreshToken = tokens.refresh_token;
  assert.ok(refreshToken);
  const replay = await fetch(String(authorization.as.token_endpoint), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: metadata.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: captured.assertion ?? "",
      refresh_token: refreshToken,
      resource: service.mcpResource,
    }),
  });
  assert.equal(replay.status, 401);
  assert.equal((await readJson(replay)).error, "invalid_client");
  const accepted = await oauth.refreshTokenGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.PrivateKeyJwt({ key: metadata.privateKey, kid: metadata.kid }),
    refreshToken,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const refreshed = await oauth.processRefreshTokenResponse(authorization.as, { client_id: metadata.clientId }, accepted);
  assert.equal(refreshed.token_type, "bearer");
});

test("metadata document private_key_jwt requires jti replay protection without consuming the code", async (t) => {
  const service = await startService(t);
  const metadata = await startPrivateKeyMetadataServer(t, service.mcpResource);
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const rejected = await fetch(String(authorization.as.token_endpoint), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: metadata.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: await signClientAssertionCryptoKey(metadata.clientId, String(authorization.as.issuer), metadata.kid, metadata.privateKey, { jti: false }),
      code: requireString(authorization.callbackParameters.get("code"), "code"),
      redirect_uri: metadata.redirectUri,
      code_verifier: authorization.codeVerifier,
      resource: service.mcpResource,
    }),
  });
  assert.equal(rejected.status, 401);
  assert.equal((await readJson(rejected)).error, "invalid_client");
  const accepted = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.PrivateKeyJwt({ key: metadata.privateKey, kid: metadata.kid }),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: metadata.clientId }, accepted, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  assert.ok(tokens.access_token);
});

test("metadata document private_key_jwt requires a JWKS URI", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource, { tokenEndpointAuthMethod: "private_key_jwt" });
  const response = await fetchAuthorizationUrl(service, metadata.clientId, metadata.redirectUri);
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

test("metadata document private_key_jwt rejects weak RSA JWKS keys", async (t) => {
  const service = await startService(t);
  const key = generateWeakPrivateKeyJwtKey("weak-metadata-key");
  const metadata = await startMetadataServer(t, service.mcpResource, {
    tokenEndpointAuthMethod: "private_key_jwt",
    jwks: { keys: [key.publicJwk] },
  });
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const response = await fetch(String(authorization.as.token_endpoint), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: metadata.clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: signClientAssertion(metadata.clientId, String(authorization.as.issuer), key.kid, key.privateKey),
      code: requireString(authorization.callbackParameters.get("code"), "code"),
      redirect_uri: metadata.redirectUri,
      code_verifier: authorization.codeVerifier,
      resource: service.mcpResource,
    }),
  });
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

function generateWeakPrivateKeyJwtKey(kid: string): { privateKey: KeyObject; publicJwk: Record<string, unknown>; kid: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024, publicExponent: 0x10001 });
  const publicJwk = publicKey.export({ format: "jwk" });
  return {
    privateKey,
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

function signClientAssertion(clientId: string, issuer: string, kid: string, privateKey: KeyObject): string {
  const signingInput = clientAssertionSigningInput(clientId, issuer, kid);
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

async function signClientAssertionCryptoKey(clientId: string, issuer: string, kid: string, privateKey: oauth.CryptoKey, options: { jti?: boolean } = {}): Promise<string> {
  const signingInput = clientAssertionSigningInput(clientId, issuer, kid, options);
  const signature = await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, Buffer.from(signingInput, "utf8"));
  return `${signingInput}.${encodeBase64Url(Buffer.from(signature))}`;
}

function clientAssertionSigningInput(clientId: string, issuer: string, kid: string, options: { jti?: boolean } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid, typ: "JWT" };
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: issuer,
    exp: now + 300,
    iat: now,
    ...(options.jti === false ? {} : { jti: randomUUID() }),
  };
  return `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(payload)}`;
}

function capturingPrivateKeyJwt(metadata: { privateKey: oauth.CryptoKey; kid: string }, captured: { assertion?: string }): oauth.ClientAuth {
  const clientAuth = oauth.PrivateKeyJwt({ key: metadata.privateKey, kid: metadata.kid });
  return async (as, client, body, headers) => {
    await clientAuth(as, client, body, headers);
    captured.assertion = body.get("client_assertion") ?? undefined;
  };
}

test("metadata document private_key_jwt requires a same-origin JWKS URI", async (t) => {
  const service = await startService(t);
  const key = await generatePrivateKeyJwtKey("metadata-key");
  const metadata = await startMetadataServer(t, service.mcpResource, {
    tokenEndpointAuthMethod: "private_key_jwt",
    jwks: { keys: [key.publicJwk] },
    jwksUriOverride: "http://localhost:1/jwks.json",
  });
  const response = await fetchAuthorizationUrl(service, metadata.clientId, metadata.redirectUri);
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

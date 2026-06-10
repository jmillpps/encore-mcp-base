import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { randomToken, s256Challenge } from "../../shared/crypto.ts";
import { readBody } from "../../shared/http.ts";
import type { UserProfile } from "../../auth/user-profile.ts";
import { signJwt } from "../../auth/tokens/jwt.ts";
import type { TestContext } from "node:test";

export interface UpstreamOidcServer {
  issuer: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  profile: UserProfile;
  stop: () => Promise<void>;
}

interface AuthorizationRecord {
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
}

interface UpstreamOidcOptions {
  omitIdToken?: boolean;
  idTokenClaims?: Record<string, unknown>;
  userinfoClaims?: Record<string, unknown>;
  metadataClaims?: Record<string, unknown>;
  signedUserinfo?: boolean;
}

export async function startUpstreamOidcServer(t: TestContext, profile: UserProfile, options: UpstreamOidcOptions = {}): Promise<UpstreamOidcServer> {
  const clientId = "upstream-client";
  const clientSecret = "upstream-secret";
  const key = upstreamSigningKey();
  const codes = new Map<string, AuthorizationRecord>();
  const accessTokens = new Set<string>();
  const server = createServer(async (req, res) => {
    try {
      const origin = serverOrigin(server);
      if (req.method === "GET" && req.url === "/.well-known/openid-configuration") {
        discovery(res, origin, clientId, options);
        return;
      }
      if (req.method === "GET" && req.url === "/jwks.json") {
        jwks(res, key.publicKey);
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/oauth2/authorize")) {
        authorize(req, res, origin, clientId, codes);
        return;
      }
      if (req.method === "POST" && req.url === "/oauth2/token") {
        await token(req, res, origin, clientId, clientSecret, key.privateKey, codes, accessTokens, profile, options);
        return;
      }
      if (req.method === "GET" && req.url === "/oauth2/userInfo") {
        userinfo(req, res, origin, clientId, key.privateKey, accessTokens, profile, options);
        return;
      }
      writeJson(res, 404, { error: "not_found" });
    } catch (error) {
      writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const issuer = serverOrigin(server);
  const result = {
    issuer,
    clientId,
    clientSecret,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    authorizationUrl: `${issuer}/oauth2/authorize`,
    tokenUrl: `${issuer}/oauth2/token`,
    userinfoUrl: `${issuer}/oauth2/userInfo`,
    profile,
    stop: () => stopServer(server),
  };
  t.after(result.stop);
  return result;
}

function authorize(req: IncomingMessage, res: ServerResponse, origin: string, clientId: string, codes: Map<string, AuthorizationRecord>): void {
  const url = new URL(req.url ?? "/", origin);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), clientId);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  const redirectUri = requiredParam(url.searchParams, "redirect_uri");
  const state = requiredParam(url.searchParams, "state");
  const codeChallenge = requiredParam(url.searchParams, "code_challenge");
  const nonce = requiredParam(url.searchParams, "nonce");
  const code = randomToken(18);
  codes.set(code, { redirectUri, codeChallenge, nonce });
  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", state);
  res.writeHead(302, { location: redirect.toString() });
  res.end();
}

async function token(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
  clientId: string,
  clientSecret: string,
  privateKey: KeyObject,
  codes: Map<string, AuthorizationRecord>,
  accessTokens: Set<string>,
  profile: UserProfile,
  options: UpstreamOidcOptions,
): Promise<void> {
  const form = new URLSearchParams(await readBody(req));
  const code = requiredParam(form, "code");
  const record = codes.get(code);
  const credentials = upstreamCredentials(req, form);
  if (!record) {
    writeJson(res, 400, { error: "invalid_grant" });
    return;
  }
  if (
    form.get("grant_type") !== "authorization_code" ||
    credentials.clientId !== clientId ||
    credentials.clientSecret !== clientSecret ||
    form.get("redirect_uri") !== record.redirectUri ||
    s256Challenge(requiredParam(form, "code_verifier")) !== record.codeChallenge
  ) {
    writeJson(res, 400, { error: "invalid_grant" });
    return;
  }
  codes.delete(code);
  const accessToken = randomToken(24);
  accessTokens.add(accessToken);
  const body: Record<string, unknown> = { access_token: accessToken, token_type: "Bearer", expires_in: 300 };
  if (!options.omitIdToken) body.id_token = idToken(origin, clientId, privateKey, profile, record.nonce, accessToken, options.idTokenClaims);
  writeJson(res, 200, body);
}

function upstreamCredentials(req: IncomingMessage, form: URLSearchParams): { clientId: string | null; clientSecret: string | null } {
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string") return { clientId: form.get("client_id"), clientSecret: form.get("client_secret") };
  if (!authorization.startsWith("Basic ")) return { clientId: null, clientSecret: null };
  const decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 1) return { clientId: null, clientSecret: null };
  return { clientId: decoded.slice(0, separator), clientSecret: decoded.slice(separator + 1) };
}

function userinfo(
  req: IncomingMessage,
  res: ServerResponse,
  origin: string,
  clientId: string,
  privateKey: KeyObject,
  accessTokens: Set<string>,
  profile: UserProfile,
  options: UpstreamOidcOptions,
): void {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!accessTokens.has(token)) {
    writeJson(res, 401, { error: "invalid_token" });
    return;
  }
  const claims = { ...profile, ...(options.userinfoClaims ?? {}) };
  if (options.signedUserinfo) {
    writeJwt(res, signJwt({ iss: origin, aud: clientId, ...claims }, "upstream-test-key", privateKey));
    return;
  }
  writeJson(res, 200, claims);
}

function discovery(res: ServerResponse, origin: string, clientId: string, options: UpstreamOidcOptions): void {
  writeJson(res, 200, {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth2/authorize`,
    token_endpoint: `${origin}/oauth2/token`,
    userinfo_endpoint: `${origin}/oauth2/userInfo`,
    jwks_uri: `${origin}/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    userinfo_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    claims_supported: ["sub", "name", "given_name", "family_name", "preferred_username", "email", "email_verified"],
    client_id: clientId,
    ...(options.metadataClaims ?? {}),
  });
}

function jwks(res: ServerResponse, publicKey: KeyObject): void {
  writeJson(res, 200, { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "upstream-test-key", alg: "RS256", use: "sig", key_ops: ["verify"] }] });
}

function idToken(
  origin: string,
  clientId: string,
  privateKey: KeyObject,
  profile: UserProfile,
  nonce: string,
  accessToken: string,
  overrides: Record<string, unknown> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: origin,
    sub: profile.sub,
    aud: clientId,
    exp: now + 300,
    iat: now,
    nonce,
    at_hash: accessTokenHash(accessToken),
    ...overrides,
  }, "upstream-test-key", privateKey);
}

function upstreamSigningKey(): { privateKey: KeyObject; publicKey: KeyObject } {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

function accessTokenHash(accessToken: string): string {
  const digest = createHash("sha256").update(accessToken, "ascii").digest();
  return digest.subarray(0, digest.length / 2).toString("base64url");
}

function requiredParam(params: URLSearchParams, key: string): string {
  const value = params.get(key);
  assert.ok(value, `${key} is required`);
  return value;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function writeJwt(res: ServerResponse, body: string): void {
  res.writeHead(200, { "content-type": "application/jwt" });
  res.end(body);
}

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

function serverOrigin(server: Server): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

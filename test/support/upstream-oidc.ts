import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { randomToken, s256Challenge } from "../../shared/crypto.ts";
import { readBody } from "../../shared/http.ts";
import type { StaticUser } from "../../auth/static-user.ts";
import type { TestContext } from "node:test";

export interface UpstreamOidcServer {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  profile: StaticUser;
  stop: () => Promise<void>;
}

interface AuthorizationRecord {
  redirectUri: string;
  codeChallenge: string;
}

export async function startUpstreamOidcServer(t: TestContext, profile: StaticUser): Promise<UpstreamOidcServer> {
  const clientId = "upstream-client";
  const clientSecret = "upstream-secret";
  const codes = new Map<string, AuthorizationRecord>();
  const accessTokens = new Set<string>();
  const server = createServer(async (req, res) => {
    try {
      const origin = serverOrigin(server);
      if (req.method === "GET" && req.url?.startsWith("/oauth2/authorize")) {
        authorize(req, res, origin, clientId, codes);
        return;
      }
      if (req.method === "POST" && req.url === "/oauth2/token") {
        await token(req, res, clientId, clientSecret, codes, accessTokens);
        return;
      }
      if (req.method === "GET" && req.url === "/oauth2/userInfo") {
        userinfo(req, res, accessTokens, profile);
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
  const code = randomToken(18);
  codes.set(code, { redirectUri, codeChallenge });
  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", state);
  res.writeHead(302, { location: redirect.toString() });
  res.end();
}

async function token(
  req: IncomingMessage,
  res: ServerResponse,
  clientId: string,
  clientSecret: string,
  codes: Map<string, AuthorizationRecord>,
  accessTokens: Set<string>,
): Promise<void> {
  const form = new URLSearchParams(await readBody(req));
  const code = requiredParam(form, "code");
  const record = codes.get(code);
  if (!record) {
    writeJson(res, 400, { error: "invalid_grant" });
    return;
  }
  if (
    form.get("grant_type") !== "authorization_code" ||
    form.get("client_id") !== clientId ||
    form.get("client_secret") !== clientSecret ||
    form.get("redirect_uri") !== record.redirectUri ||
    s256Challenge(requiredParam(form, "code_verifier")) !== record.codeChallenge
  ) {
    writeJson(res, 400, { error: "invalid_grant" });
    return;
  }
  codes.delete(code);
  const accessToken = randomToken(24);
  accessTokens.add(accessToken);
  writeJson(res, 200, { access_token: accessToken, token_type: "Bearer", expires_in: 300 });
}

function userinfo(req: IncomingMessage, res: ServerResponse, accessTokens: Set<string>, profile: StaticUser): void {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!accessTokens.has(token)) {
    writeJson(res, 401, { error: "invalid_token" });
    return;
  }
  writeJson(res, 200, profile);
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

async function stopServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

function serverOrigin(server: Server): string {
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

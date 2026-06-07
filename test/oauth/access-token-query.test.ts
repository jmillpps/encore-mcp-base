import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { localRedirectUri } from "../support/oauth-client.ts";
import { startService } from "../support/service-process.ts";

test("public OAuth endpoints reject access tokens in the URI query", async (t) => {
  const service = await startService(t);
  for (const endpoint of [
    route("/.well-known/openid-configuration", 200),
    route("/.well-known/oauth-authorization-server", 200),
    route("/.well-known/oauth-protected-resource", 200),
    route("/.well-known/oauth-protected-resource/mcp", 200),
    route("/oauth/jwks", 200),
    route(authorizePath(service.actionsAudience), 302),
  ]) {
    const response = await fetch(`${service.origin}${withAccessTokenQuery(endpoint.path)}`, { redirect: "manual" });
    assert.equal(response.status, 400, endpoint.path);
    const body = await readJson(response);
    assert.equal(body.error, "bad_request", endpoint.path);
    const cleanResponse = await fetch(`${service.origin}${endpoint.path}`, { redirect: "manual" });
    assert.equal(cleanResponse.status, endpoint.cleanStatus, endpoint.path);
  }
});

interface Route {
  path: string;
  cleanStatus: number;
}

function route(path: string, cleanStatus: number): Route {
  return { path, cleanStatus };
}

function withAccessTokenQuery(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}access_token=query-token`;
}

function authorizePath(resource: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: "local-test",
    redirect_uri: localRedirectUri,
    state: "query-token-state",
    resource,
    code_challenge: "x".repeat(43),
    code_challenge_method: "S256",
  });
  return `/oauth/authorize?${params.toString()}`;
}

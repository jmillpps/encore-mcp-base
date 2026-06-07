import assert from "node:assert/strict";
import test from "node:test";
import { resolveOAuthAuthorizationResource, resolveOAuthGrantResource } from "../../auth/oauth-resource.ts";
import type { OAuthClient } from "../../auth/client-types.ts";

test("OAuth resource matching normalizes uppercase scheme and host", () => {
  const client = testClient(["https://mcp.example.com/mcp"]);
  assert.equal(resolveOAuthAuthorizationResource(client, "HTTPS://MCP.EXAMPLE.COM/mcp"), "https://mcp.example.com/mcp");
  assert.equal(resolveOAuthGrantResource(client, "HTTPS://MCP.EXAMPLE.COM/mcp"), "https://mcp.example.com/mcp");
});

function testClient(allowedResources: string[]): OAuthClient {
  return {
    clientId: "resource-test",
    clientSecretHash: "a".repeat(43),
    displayName: "Resource Test",
    redirectUris: ["https://client.example.com/callback"],
    allowedScopes: ["openid"],
    allowedResources,
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "required",
    clientClass: "resource-test",
  };
}

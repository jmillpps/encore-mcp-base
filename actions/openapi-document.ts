type JsonObject = Record<string, unknown>;

import { actionComponents, actionPaths, type ActionRoute } from "./action-contract.ts";
import { actionRouteManifest } from "./action-route-manifest.generated.ts";

export function openApiDocument(baseUrl: string, routes: readonly ActionRoute[] = actionRouteManifest): JsonObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "GPT MCP Service Actions API",
      description: "OAuth-protected profile and session actions for the GPT MCP Service.",
      version: "0.1.0",
    },
    servers: [{ url: baseUrl }],
    "x-source": "actions-contract-registry",
    "x-route-graph-verification": "encore-check",
    paths: actionPaths(routes),
    components: actionComponents(baseUrl),
  };
}

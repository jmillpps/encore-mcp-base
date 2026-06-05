import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { verifyBearer } from "../auth/bearer.ts";
import { staticUser } from "../auth/static-user.ts";
import { authChallengeResult } from "./auth-challenge.ts";

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  securitySchemes: Record<string, unknown>[];
  requiredScopes: string[];
  run: (context: ToolContext, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ToolContext {
  config: ServiceConfig;
  authorization?: string;
}

export const tools: McpTool[] = [
  {
    name: "health.check",
    title: "Health Check",
    description: "Check whether the service is reachable.",
    inputSchema: emptyInput(),
    outputSchema: objectOutput(["status", "service"]),
    securitySchemes: [{ type: "noauth" }],
    requiredScopes: [],
    run: async () => ({ content: [{ type: "text", text: "ok" }], structuredContent: { status: "ok", service: "gpt-mcp-service" } }),
  },
  {
    name: "identity.profile",
    title: "Identity Profile",
    description: "Return the authenticated static user profile.",
    inputSchema: emptyInput(),
    outputSchema: objectOutput(["sub", "email", "name"]),
    securitySchemes: [{ type: "oauth2", scopes: ["openid", "profile", "email"] }],
    requiredScopes: ["openid", "profile", "email"],
    run: async (context) => protectedResult(context, ["openid", "profile", "email"], staticUser),
  },
  {
    name: "auth.session",
    title: "Auth Session",
    description: "Return authenticated token session metadata.",
    inputSchema: emptyInput(),
    outputSchema: objectOutput(["subject", "clientId", "audience"]),
    securitySchemes: [{ type: "oauth2", scopes: ["openid"] }],
    requiredScopes: ["openid"],
    run: async (context) => {
      const claims = verifyBearer(context.config, context.authorization, context.config.mcpResource, ["openid"]);
      return {
        content: [{ type: "text", text: claims.sub }],
        structuredContent: { subject: claims.sub, clientId: claims.client_id, audience: claims.aud, scopes: claims.scope.split(/\s+/).filter(Boolean) },
      };
    },
  },
];

export function listTools(): Record<string, unknown> {
  return { tools: tools.map(({ run: _run, requiredScopes: _requiredScopes, ...tool }) => tool) };
}

export async function callTool(context: ToolContext, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new ServiceError("not_found", "tool not found", 404);
  try {
    return await tool.run(context, args);
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
      return authChallengeResult(context.config, tool.requiredScopes);
    }
    throw error;
  }
}

async function protectedResult(context: ToolContext, scopes: string[], value: unknown): Promise<Record<string, unknown>> {
  verifyBearer(context.config, context.authorization, context.config.mcpResource, scopes);
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
}

function emptyInput(): Record<string, unknown> {
  return { type: "object", properties: {}, additionalProperties: false };
}

function objectOutput(required: string[]): Record<string, unknown> {
  return { type: "object", required, properties: Object.fromEntries(required.map((key) => [key, { type: "string" }])) };
}

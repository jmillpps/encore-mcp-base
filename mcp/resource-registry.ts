import { verifyBearer } from "../auth/bearer.ts";
import { enforceRateLimit } from "../auth/rate-limit.ts";
import { ServiceError } from "../shared/errors.ts";
import { McpAuthChallengeError } from "./auth-challenge.ts";
import { McpProtocolError } from "./protocol-error.ts";
import { healthStatusCardResource } from "./resources/health-status-card.ts";
import { profileSummaryCardResource } from "./resources/profile-summary-card.ts";
import { assertResourceContents, assertResourceDefinitions, resourceDescriptor, resourceTemplateDescriptor } from "./resource-validation.ts";
import type { McpResourceDefinition, McpResourceTemplate, ResourceContext } from "./resource-types.ts";

export const resources: McpResourceDefinition[] = [healthStatusCardResource, profileSummaryCardResource];
export const resourceTemplates: McpResourceTemplate[] = [];

export function listResources(): Record<string, unknown> {
  assertResourceDefinitions(resources, resourceTemplates);
  return { resources: resources.map(resourceDescriptor) };
}

export function listResourceTemplates(): Record<string, unknown> {
  assertResourceDefinitions(resources, resourceTemplates);
  return { resourceTemplates: resourceTemplates.map(resourceTemplateDescriptor) };
}

export async function readResource(context: ResourceContext, uri: string): Promise<Record<string, unknown>> {
  assertResourceDefinitions(resources, resourceTemplates);
  await enforceRateLimit(context.config, "mcp-resource", context.rateLimitSubject ?? "unknown");
  const resource = resources.find((candidate) => candidate.uri === uri);
  if (!resource) throw new McpProtocolError(-32002, "Resource not found");
  enforceResourceScopes(context, resource);
  const contents = Array.isArray(resource.contents) ? resource.contents : await resource.contents(context);
  assertResourceContents(contents);
  return { contents };
}

function enforceResourceScopes(context: ResourceContext, resource: McpResourceDefinition): void {
  if (resource.requiredScopes.length === 0) return;
  try {
    verifyBearer(context.config, context.authorization, context.config.mcpResource, resource.requiredScopes);
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
      throw new McpAuthChallengeError(resource.requiredScopes, error);
    }
    throw error;
  }
}

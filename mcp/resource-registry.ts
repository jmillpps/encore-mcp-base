import { verifyBearer } from "../auth/bearer.ts";
import { enforceRateLimit } from "../auth/rate-limit.ts";
import { ServiceError } from "../shared/errors.ts";
import { McpAuthChallengeError } from "./auth-challenge.ts";
import { paginatedList } from "./pagination.ts";
import { McpProtocolError } from "./protocol-error.ts";
import { assertResourceContents, assertResourceDefinitions, resourceDescriptor, resourceTemplateDescriptor } from "./resource-validation.ts";
import type { McpResourceDefinition, McpResourceTemplate, ResourceContext } from "./resource-types.ts";
import { widgetResources } from "./widgets/index.ts";
import { applyWidgetRuntimeMetadata } from "./widgets/runtime-metadata.ts";

export const resources: McpResourceDefinition[] = [...widgetResources];
export const resourceTemplates: McpResourceTemplate[] = [];

export function listResources(params?: unknown, pageSize = Math.max(1, resources.length)): Record<string, unknown> {
  assertResourceDefinitions(resources, resourceTemplates);
  return paginatedList(params, "resources/list", "resources", resources.map(resourceDescriptor), pageSize);
}

export function listResourceTemplates(params?: unknown, pageSize = Math.max(1, resourceTemplates.length)): Record<string, unknown> {
  assertResourceDefinitions(resources, resourceTemplates);
  return paginatedList(params, "resources/templates/list", "resourceTemplates", resourceTemplates.map(resourceTemplateDescriptor), pageSize);
}

export async function readResource(context: ResourceContext, uri: string): Promise<Record<string, unknown>> {
  assertResourceDefinitions(resources, resourceTemplates);
  await enforceRateLimit(context.config, "mcp-resource", context.rateLimitSubject ?? "unknown");
  const resource = resources.find((candidate) => candidate.uri === uri);
  if (!resource) throw new McpProtocolError(-32002, "Resource not found");
  enforceResourceScopes(context, resource);
  const resourceContents = Array.isArray(resource.contents) ? resource.contents : await resource.contents(context);
  const contents = applyWidgetRuntimeMetadata(context.config, resourceContents);
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

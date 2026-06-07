import { ServiceError } from "../shared/errors.ts";
import type { OAuthClient } from "./client-types.ts";

export function resolveOAuthAuthorizationResource(client: OAuthClient, resource: string | undefined): string {
  const resolved = resolveGrantResource(client, resource);
  if (!client.allowedResources.includes(resolved)) {
    throw new ServiceError("bad_request", "resource is not allowed", 400);
  }
  return resolved;
}

export function resolveOAuthGrantResource(client: OAuthClient, resource: string | undefined): string {
  return resolveGrantResource(client, resource);
}

function resolveGrantResource(client: OAuthClient, resource: string | undefined): string {
  if (resource !== undefined) return assertPresentResource(resource);
  const defaultResource = defaultActionsResource(client);
  if (defaultResource) return defaultResource;
  throw new ServiceError("bad_request", "resource is required", 400);
}

function assertPresentResource(resource: string): string {
  if (!resource) throw new ServiceError("bad_request", "resource is required", 400);
  return resource;
}

function defaultActionsResource(client: OAuthClient): string | undefined {
  if (client.clientClass !== "gpt-actions" || client.allowedResources.length !== 1) return undefined;
  return client.allowedResources[0];
}

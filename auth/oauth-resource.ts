import { ServiceError } from "../shared/errors.ts";
import type { OAuthClient } from "./client-types.ts";

export function resolveOAuthAuthorizationResource(client: OAuthClient, resource: string | undefined): string {
  return resolveAllowedResource(client, resolveGrantResource(client, resource));
}

export function resolveOAuthGrantResource(client: OAuthClient, resource: string | undefined): string {
  return resolveAllowedResource(client, resolveGrantResource(client, resource));
}

function resolveGrantResource(client: OAuthClient, resource: string | undefined): string {
  if (resource !== undefined) return assertPresentResource(resource);
  const defaultResource = defaultActionsResource(client);
  if (defaultResource) return defaultResource;
  throw invalidTarget("resource is required");
}

function assertPresentResource(resource: string): string {
  if (!resource) throw invalidTarget("resource is required");
  return resource;
}

function defaultActionsResource(client: OAuthClient): string | undefined {
  if (client.clientClass !== "gpt-actions" || client.allowedResources.length !== 1) return undefined;
  return client.allowedResources[0];
}

function resolveAllowedResource(client: OAuthClient, resource: string): string {
  if (!client.allowedResources.includes(resource)) throw invalidTarget("resource is not allowed");
  return resource;
}

function invalidTarget(message: string): ServiceError {
  return new ServiceError("invalid_target", message, 400);
}

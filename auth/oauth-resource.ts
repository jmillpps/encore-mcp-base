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
  const canonical = canonicalResource(resource);
  const allowed = client.allowedResources.find((allowedResource) => canonicalResource(allowedResource) === canonical);
  if (!allowed) throw invalidTarget("resource is not allowed");
  return allowed;
}

function canonicalResource(resource: string): string {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    throw invalidTarget("resource is invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw invalidTarget("resource is invalid");
  if (url.username || url.password || url.hash) throw invalidTarget("resource is invalid");
  if (resource.includes("*")) throw invalidTarget("resource is invalid");
  return url.href.replace(/\/$/, "");
}

function invalidTarget(message: string): ServiceError {
  return new ServiceError("invalid_target", message, 400);
}

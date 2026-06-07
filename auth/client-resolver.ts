import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { resolveClientIdMetadataDocument } from "./client-id-metadata-document.ts";
import type { OAuthClient } from "./client-types.ts";

export async function resolveClient(config: ServiceConfig, clients: readonly OAuthClient[], clientId: string): Promise<OAuthClient> {
  const client = clients.find((candidate) => candidate.clientId === clientId);
  if (client) return client;
  if (!isUrlClientId(clientId)) throw new ServiceError("invalid_client", "invalid client", 401);
  return resolveClientIdMetadataDocument(config, clientId);
}

function isUrlClientId(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

import { Buffer } from "node:buffer";
import { ServiceError } from "../shared/errors.ts";
import type { TokenEndpointAuthMethod } from "./client-types.ts";

export interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
  method: TokenEndpointAuthMethod;
}

export function readClientCredentials(form: URLSearchParams, authorization: string | undefined): ClientCredentials {
  if (authorization) {
    if (!authorization.startsWith("Basic ")) throw new ServiceError("invalid_client", "invalid client", 401);
    return readBasicCredentials(form, authorization);
  }
  const clientId = form.get("client_id");
  if (!clientId) throw new ServiceError("invalid_client", "invalid client", 401);
  const clientSecret = form.get("client_secret") ?? undefined;
  return { clientId, method: "client_secret_post", ...(clientSecret ? { clientSecret } : {}) };
}

function readBasicCredentials(form: URLSearchParams, header: string): ClientCredentials {
  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) throw new Error("bad basic credentials");
    if (form.get("client_secret")) throw new Error("ambiguous client credentials");
    const clientId = decodeURIComponent(decoded.slice(0, separator));
    const formClientId = form.get("client_id");
    if (formClientId && formClientId !== clientId) throw new Error("ambiguous client credentials");
    return {
      clientId,
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
      method: "client_secret_basic",
    };
  } catch {
    throw new ServiceError("invalid_client", "invalid client", 401);
  }
}

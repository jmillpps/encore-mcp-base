import { Buffer } from "node:buffer";
import { ServiceError } from "../shared/errors.ts";

export interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
}

export function readClientCredentials(form: URLSearchParams, authorization: string | undefined): ClientCredentials {
  if (authorization?.startsWith("Basic ")) return readBasicCredentials(authorization);
  const clientId = form.get("client_id");
  if (!clientId) throw new ServiceError("invalid_client", "invalid client", 401);
  const clientSecret = form.get("client_secret") ?? undefined;
  return { clientId, ...(clientSecret ? { clientSecret } : {}) };
}

function readBasicCredentials(header: string): ClientCredentials {
  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) throw new Error("bad basic credentials");
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    throw new ServiceError("invalid_client", "invalid client", 401);
  }
}

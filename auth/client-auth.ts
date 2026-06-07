import { ServiceError } from "../shared/errors.ts";
import { readAuthorizationCredentials } from "./authorization-header.ts";
import { decodeBasicCredentials } from "./basic-credentials.ts";
import type { TokenEndpointAuthMethod } from "./client-types.ts";

export interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
  method: TokenEndpointAuthMethod;
}

export function readClientCredentials(form: URLSearchParams, authorization: string | undefined): ClientCredentials {
  if (authorization) {
    const credentials = readAuthorizationCredentials(authorization, "Basic", { code: "invalid_client", message: "invalid client", status: 401 });
    return readBasicCredentials(form, credentials);
  }
  const clientId = form.get("client_id");
  if (!clientId) throw new ServiceError("invalid_client", "invalid client", 401);
  if (!form.has("client_secret")) return { clientId, method: "none" };
  const clientSecret = form.get("client_secret") ?? "";
  return { clientId, method: "client_secret_post", clientSecret };
}

function readBasicCredentials(form: URLSearchParams, credentials: string): ClientCredentials {
  const decoded = decodeBasicCredentials(credentials);
  if (!decoded) throw new ServiceError("invalid_client", "invalid client", 401);
  if (form.get("client_secret")) throw new ServiceError("invalid_client", "invalid client", 401);
  const formClientId = form.get("client_id");
  if (formClientId && formClientId !== decoded.clientId) throw new ServiceError("invalid_client", "invalid client", 401);
  return { clientId: decoded.clientId, clientSecret: decoded.clientSecret, method: "client_secret_basic" };
}

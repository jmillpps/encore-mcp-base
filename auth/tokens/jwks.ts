import type { ServiceConfig } from "../../shared/config.ts";
import { getSigningKey } from "./signing-keys.ts";

export interface JwksDocument {
  keys: Record<string, unknown>[];
}

export function jwks(config: ServiceConfig): JwksDocument {
  const key = getSigningKey(config);
  const jwk = key.publicKey.export({ format: "jwk" });
  return { keys: [{ ...jwk, kid: key.kid, alg: "RS256", use: "sig" }] };
}

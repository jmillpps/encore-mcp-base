import type { ServiceConfig } from "../../shared/config.ts";
import { getVerificationKeys } from "./signing-keys.ts";

export interface JwksDocument {
  keys: Record<string, unknown>[];
}

export function jwks(config: ServiceConfig): JwksDocument {
  return { keys: getVerificationKeys(config).map((key) => ({ ...key.publicKey.export({ format: "jwk" }), kid: key.kid, alg: "RS256", use: "sig" })) };
}

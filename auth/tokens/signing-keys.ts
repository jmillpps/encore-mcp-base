import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { ServiceConfig } from "../../shared/config.ts";

export interface SigningKey {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

let cached: SigningKey | undefined;

export function getSigningKey(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): SigningKey {
  if (cached) return cached;
  if (env.OAUTH_PRIVATE_KEY_PEM) {
    const privateKey = createPrivateKey(env.OAUTH_PRIVATE_KEY_PEM);
    const publicKey = createPublicKey(privateKey);
    cached = { kid: env.OAUTH_KEY_ID ?? keyId(privateKey), privateKey, publicKey };
    return cached;
  }
  if (config.production) throw new Error("OAUTH_PRIVATE_KEY_PEM is required");
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  cached = { kid: keyId(pair.publicKey), privateKey: pair.privateKey, publicKey: pair.publicKey };
  return cached;
}

function keyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 24);
}

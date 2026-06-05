import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { ServiceConfig } from "../../shared/config.ts";

export interface SigningKey {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

let cached: { source: string; key: SigningKey } | undefined;

export function getSigningKey(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): SigningKey {
  if (env.OAUTH_PRIVATE_KEY_PEM) {
    const source = `pem:${createHash("sha256").update(env.OAUTH_PRIVATE_KEY_PEM, "utf8").digest("base64url")}:${env.OAUTH_KEY_ID ?? ""}`;
    if (cached?.source === source) return cached.key;
    const privateKey = createPrivateKey(env.OAUTH_PRIVATE_KEY_PEM);
    const publicKey = createPublicKey(privateKey);
    const key = { kid: env.OAUTH_KEY_ID ?? keyId(publicKey), privateKey, publicKey };
    cached = { source, key };
    return key;
  }
  if (config.production) throw new Error("OAUTH_PRIVATE_KEY_PEM is required");
  if (cached?.source === "local") return cached.key;
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = { kid: keyId(pair.publicKey), privateKey: pair.privateKey, publicKey: pair.publicKey };
  cached = { source: "local", key };
  return key;
}

function keyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 24);
}

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { ServiceConfig } from "../../shared/config.ts";

export interface VerificationKey {
  kid: string;
  publicKey: KeyObject;
}

export interface SigningKey extends VerificationKey {
  privateKey: KeyObject;
}

interface KeySet {
  active: SigningKey;
  verificationKeys: VerificationKey[];
}

let cached: { source: string; keySet: KeySet } | undefined;
const keyIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export function getSigningKey(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): SigningKey {
  return getKeySet(config, env).active;
}

export function getVerificationKeys(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): VerificationKey[] {
  return getKeySet(config, env).verificationKeys;
}

function getKeySet(config: ServiceConfig, env: NodeJS.ProcessEnv): KeySet {
  if (env.OAUTH_PRIVATE_KEY_PEM) {
    const source = `pem:${hashSource(env.OAUTH_PRIVATE_KEY_PEM)}:${env.OAUTH_KEY_ID ?? ""}:${hashSource(env.OAUTH_PREVIOUS_PUBLIC_KEYS_JSON ?? "")}`;
    if (cached?.source === source) return cached.keySet;
    const privateKey = createPrivateKey(env.OAUTH_PRIVATE_KEY_PEM);
    const publicKey = createPublicKey(privateKey);
    const active = { kid: activeKeyId(config, env, publicKey), privateKey, publicKey };
    const verificationKeys = [active, ...previousKeys(env.OAUTH_PREVIOUS_PUBLIC_KEYS_JSON)];
    rejectDuplicateKids(verificationKeys);
    const keySet = { active, verificationKeys };
    cached = { source, keySet };
    return keySet;
  }
  if (config.production) throw new Error("OAUTH_PRIVATE_KEY_PEM is required");
  if (cached?.source === "local") return cached.keySet;
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const active = { kid: keyId(pair.publicKey), privateKey: pair.privateKey, publicKey: pair.publicKey };
  const keySet = { active, verificationKeys: [active] };
  cached = { source: "local", keySet };
  return keySet;
}

function previousKeys(value: string | undefined): VerificationKey[] {
  if (!value?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("OAUTH_PREVIOUS_PUBLIC_KEYS_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("OAUTH_PREVIOUS_PUBLIC_KEYS_JSON must be an array");
  return parsed.map((entry) => previousKey(entry));
}

function previousKey(value: unknown): VerificationKey {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("previous signing key must be an object");
  const record = value as Record<string, unknown>;
  if (typeof record.kid !== "string" || record.kid.trim() === "") throw new Error("previous signing key kid is required");
  if (typeof record.publicKeyPem !== "string" || record.publicKeyPem.trim() === "") throw new Error("previous signing key publicKeyPem is required");
  return { kid: validatedKeyId(record.kid, "previous signing key kid"), publicKey: createPublicKey(record.publicKeyPem) };
}

function rejectDuplicateKids(keys: VerificationKey[]): void {
  if (new Set(keys.map((key) => key.kid)).size !== keys.length) throw new Error("signing key ids must be unique");
}

function hashSource(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function activeKeyId(config: ServiceConfig, env: NodeJS.ProcessEnv, publicKey: KeyObject): string {
  if (!env.OAUTH_KEY_ID?.trim()) {
    if (config.production) throw new Error("OAUTH_KEY_ID is required");
    return keyId(publicKey);
  }
  return validatedKeyId(env.OAUTH_KEY_ID, "OAUTH_KEY_ID");
}

function validatedKeyId(value: string, name: string): string {
  if (!keyIdPattern.test(value)) throw new Error(`${name} must use 1-128 safe key id characters`);
  return value;
}

function keyId(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 24);
}

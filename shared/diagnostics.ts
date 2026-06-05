import { createHash } from "node:crypto";
import { nowSeconds } from "./time.ts";

export type DiagnosticLevel = "info" | "warn" | "error";

export interface DiagnosticEvent {
  ts: number;
  level: DiagnosticLevel;
  event: string;
  fields: Record<string, unknown>;
}

export type DiagnosticSink = (event: DiagnosticEvent) => void;

const exactSecretKeys = new Set([
  "authcode",
  "authorizationcode",
  "codechallenge",
  "codeverifier",
  "oauthcode",
  "nonce",
  "sessionid",
  "state",
]);
const secretFragments = ["apikey", "authorization", "cookie", "password", "privatekey", "secret", "signingkey", "token"];
let sink: DiagnosticSink = (event) => {
  process.stderr.write(`${JSON.stringify(event)}\n`);
};

export function emitDiagnostic(level: DiagnosticLevel, event: string, fields: Record<string, unknown> = {}): void {
  sink({ ts: nowSeconds(), level, event, fields: redactFields(fields) });
}

export function setDiagnosticSink(next: DiagnosticSink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redactValue(key, value)]));
}

function redactValue(key: string, value: unknown): unknown {
  if (isSecretKey(key)) return redacted(value);
  if (value && typeof value === "object" && !Array.isArray(value)) return redactFields(value as Record<string, unknown>);
  if (Array.isArray(value)) return value.map((entry) => redactValue(key, entry));
  return value;
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return exactSecretKeys.has(normalized) || secretFragments.some((fragment) => normalized.includes(fragment));
}

function redacted(value: unknown): string {
  if (typeof value !== "string" || value === "") return "[redacted]";
  return `[redacted:${createHash("sha256").update(value, "utf8").digest("base64url").slice(0, 12)}]`;
}

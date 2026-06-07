#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isLoopbackHostname, isNonPublicHostname } from "../shared/network-address.ts";
import { assertChatGptActionsOpenApi } from "./openapi-actions-compatibility.ts";
import { openApiDocument } from "./openapi-document.ts";
import { loadValidatedEncoreGraph } from "./openapi-graph.ts";

interface ExportOptions {
  baseUrl: string;
  out: string;
  build: boolean;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const options = parseArgs(process.argv.slice(2));
await loadValidatedEncoreGraph(root, options.build);
const document = openApiDocument(options.baseUrl);
assertChatGptActionsOpenApi(document);
const output = `${JSON.stringify(document, null, 2)}\n`;
if (options.out) {
  const outPath = resolveOutputPath(root, options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, output, { mode: 0o600 });
} else {
  process.stdout.write(output);
}

function parseArgs(args: string[]): ExportOptions {
  const parsed = { baseUrl: process.env.PUBLIC_ISSUER_URL ?? "http://localhost:4000", out: "", build: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--base-url") parsed.baseUrl = requiredArg(args, (index += 1), arg);
    else if (arg === "--out") parsed.out = requiredArg(args, (index += 1), arg);
    else if (arg === "--no-build") parsed.build = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  parsed.baseUrl = normalizeBaseUrl(parsed.baseUrl);
  return parsed;
}

function requiredArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("base URL must use http or https");
  if (url.protocol === "http:" && !isLocalHttpHost(url.hostname)) throw new Error("public base URL must use https");
  if (url.username || url.password || url.search || url.hash) throw new Error("base URL contains unsupported URL parts");
  if (url.pathname !== "/") throw new Error("base URL must not include a path");
  if (url.protocol === "https:" && isNonPublicHostname(url.hostname)) throw new Error("public base URL must use a public host");
  return url.href.replace(/\/$/, "");
}

function isLocalHttpHost(hostname: string): boolean {
  return isLoopbackHostname(hostname);
}

function resolveOutputPath(projectRoot: string, value: string): string {
  if (value.trim() !== value) throw new Error("output path cannot include surrounding whitespace");
  if (!value.endsWith(".json")) throw new Error("output path must end with .json");
  const path = resolve(projectRoot, value);
  const projectRelative = relative(projectRoot, path);
  if (!projectRelative || projectRelative.startsWith("..") || isAbsolute(projectRelative)) {
    throw new Error("output path must stay inside the project");
  }
  return path;
}

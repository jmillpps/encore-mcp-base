import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import { startUpstreamOidcServer } from "./upstream-oidc.ts";
import { testUserProfile } from "./user-profile.ts";

export interface TestService {
  origin: string;
  actionsAudience: string;
  mcpResource: string;
  storePath: string;
  stop: () => Promise<void>;
}

export type ServiceEnvOverrides = NodeJS.ProcessEnv | ((origin: string, storePath: string) => NodeJS.ProcessEnv);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function startService(t: TestContext, envOverrides: ServiceEnvOverrides = {}): Promise<TestService> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const upstream = await startUpstreamOidcServer(t, testUserProfile);
  const tempDir = await mkdtemp(join(tmpdir(), "mcp-service-test-"));
  const storePath = join(tempDir, "oauth-store.json");
  const child = spawn("encore", ["run", "--browser=never", "--port", String(port)], {
    cwd: projectRoot,
    env: serviceEnv(origin, storePath, upstreamEnv(origin, upstream), envOverridesFor(origin, storePath, envOverrides)),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let exited: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  const append = (chunk: Buffer): void => {
    output = `${output}${chunk.toString("utf8")}`.slice(-24000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });
  const service = {
    origin,
    actionsAudience: `${origin}/actions`,
    mcpResource: `${origin}/mcp`,
    storePath,
    stop: async () => {
      await stopChild(child);
      await rm(tempDir, { recursive: true, force: true });
    },
  };
  t.after(service.stop);
  await waitForHealth(origin, () => exited, () => output);
  return service;
}

export async function expectServiceStartupFailure(t: TestContext, envOverrides: NodeJS.ProcessEnv): Promise<string> {
  const port = await freePort();
  const tempDir = await mkdtemp(join(tmpdir(), "mcp-service-failure-test-"));
  const child = spawn("encore", ["run", "--browser=never", "--port", String(port)], {
    cwd: projectRoot,
    env: cleanEnv({ ...process.env, ...envOverrides }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk: Buffer): void => {
    output = `${output}${chunk.toString("utf8")}`.slice(-24000);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  t.after(async () => {
    await stopChild(child);
    await rm(tempDir, { recursive: true, force: true });
  });
  const exit = await waitForExit(child, 30000);
  if (exit.code === 0 && !/Error:/i.test(output)) throw new Error(`Encore startup succeeded unexpectedly\n${output}`);
  return output;
}

function serviceEnv(origin: string, storePath: string, upstream: NodeJS.ProcessEnv, envOverrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...upstream,
    PUBLIC_ISSUER_URL: origin,
    MCP_RESOURCE_URL: `${origin}/mcp`,
    ACTIONS_AUDIENCE: `${origin}/actions`,
    OAUTH_STORE_PATH: storePath,
    ALLOWED_ORIGINS: "https://chatgpt.com https://chat.openai.com http://localhost:4000",
    ...envOverrides,
  };
  delete env.NODE_ENV;
  return env;
}

function envOverridesFor(origin: string, storePath: string, envOverrides: ServiceEnvOverrides): NodeJS.ProcessEnv {
  return typeof envOverrides === "function" ? envOverrides(origin, storePath) : envOverrides;
}

function upstreamEnv(origin: string, upstream: { issuer: string; authorizationUrl: string; tokenUrl: string; userinfoUrl: string; clientId: string; clientSecret: string }): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: upstream.issuer,
    UPSTREAM_OIDC_AUTHORIZATION_URL: upstream.authorizationUrl,
    UPSTREAM_OIDC_TOKEN_URL: upstream.tokenUrl,
    UPSTREAM_OIDC_USERINFO_URL: upstream.userinfoUrl,
    UPSTREAM_OIDC_CLIENT_ID: upstream.clientId,
    UPSTREAM_OIDC_CLIENT_SECRET: upstream.clientSecret,
    UPSTREAM_OIDC_REDIRECT_URI: `${origin}/oauth/callback`,
    UPSTREAM_OIDC_SCOPES: "openid profile email",
    UPSTREAM_OIDC_TOKEN_AUTH_METHOD: "client_secret_post",
  };
}

function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

async function waitForHealth(
  origin: string,
  exited: () => { code: number | null; signal: NodeJS.Signals | null } | undefined,
  output: () => string,
): Promise<void> {
  const deadline = Date.now() + 60000;
  let lastError = "";
  while (Date.now() < deadline) {
    const exit = exited();
    if (exit) throw new Error(`Encore exited before health check: ${exit.code ?? exit.signal}\n${output()}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Encore health check timed out: ${lastError}\n${output()}`);
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const finished = once(child, "exit").then(() => undefined);
  child.kill("SIGINT");
  if (await exitsBefore(finished, 5000)) return;
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  if (!(await exitsBefore(finished, 5000))) throw new Error("Encore process did not exit after SIGKILL");
}

async function exitsBefore(finished: Promise<void>, timeoutMs: number): Promise<boolean> {
  return Promise.race([finished.then(() => true), delay(timeoutMs).then(() => false)]);
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Encore startup failure check timed out"));
    }, timeoutMs);
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolveExit({ code, signal });
    });
  });
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("port allocation failed");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return port;
}

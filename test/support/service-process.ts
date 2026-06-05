import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";

export interface TestService {
  origin: string;
  actionsAudience: string;
  mcpResource: string;
  storePath: string;
  stop: () => Promise<void>;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function startService(t: TestContext): Promise<TestService> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const tempDir = await mkdtemp(join(tmpdir(), "mcp-service-test-"));
  const storePath = join(tempDir, "oauth-store.json");
  const child = spawn("encore", ["run", "--browser=never", "--port", String(port)], {
    cwd: projectRoot,
    env: serviceEnv(origin, storePath),
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
    mcpResource: origin,
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

function serviceEnv(origin: string, storePath: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PUBLIC_ISSUER_URL: origin,
    MCP_RESOURCE_URL: origin,
    ACTIONS_AUDIENCE: `${origin}/actions`,
    OAUTH_STORE_PATH: storePath,
    ALLOWED_ORIGINS: "https://chatgpt.com https://chat.openai.com http://localhost:4000",
  };
  delete env.NODE_ENV;
  return env;
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
  child.kill("SIGINT");
  const finished = once(child, "exit").then(() => undefined);
  const killed = delay(5000).then(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  });
  await Promise.race([finished, killed]);
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

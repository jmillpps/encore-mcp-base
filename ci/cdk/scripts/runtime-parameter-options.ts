import { stackName } from "../src/config.ts";

export interface RuntimeParameterOptions {
  stackName: string;
  actionsClientId: string;
  actionsDisplayName: string;
  actionsRedirectUris: string[];
  mcpClientId: string;
  mcpDisplayName: string;
  mcpRedirectUris: string[];
}

const identifierPattern = /^[A-Za-z0-9._:-]+$/;
const unsafeDisplayNamePattern = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
const maximumDisplayNameLength = 128;

export function parseRuntimeParameterOptions(args: string[], env: NodeJS.ProcessEnv = process.env): RuntimeParameterOptions {
  const parsed = {
    stackName: env.CDK_STACK_NAME ?? "",
    actionsClientId: "",
    actionsDisplayName: "GPT Actions",
    actionsRedirectUris: [] as string[],
    mcpClientId: "",
    mcpDisplayName: "GPT Apps MCP",
    mcpRedirectUris: [] as string[],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--stack-name") parsed.stackName = requiredArg(args, (index += 1), arg);
    else if (arg === "--actions-client-id") parsed.actionsClientId = requiredArg(args, (index += 1), arg);
    else if (arg === "--actions-display-name") parsed.actionsDisplayName = requiredArg(args, (index += 1), arg);
    else if (arg === "--actions-redirect-uri") parsed.actionsRedirectUris.push(requiredArg(args, (index += 1), arg));
    else if (arg === "--mcp-client-id") parsed.mcpClientId = requiredArg(args, (index += 1), arg);
    else if (arg === "--mcp-display-name") parsed.mcpDisplayName = requiredArg(args, (index += 1), arg);
    else if (arg === "--mcp-redirect-uri") parsed.mcpRedirectUris.push(requiredArg(args, (index += 1), arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  parsed.stackName = stackName(parsed.stackName);
  validateIdentifier(parsed.actionsClientId, "--actions-client-id");
  validateDisplayName(parsed.actionsDisplayName, "--actions-display-name");
  if (parsed.actionsRedirectUris.length === 0) throw new Error("--actions-redirect-uri is required");
  validateIdentifier(parsed.mcpClientId, "--mcp-client-id");
  validateDisplayName(parsed.mcpDisplayName, "--mcp-display-name");
  if (parsed.mcpRedirectUris.length === 0) throw new Error("--mcp-redirect-uri is required");
  return parsed;
}

function requiredArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function validateIdentifier(value: string, name: string): void {
  if (!value) throw new Error(`${name} is required`);
  if (!identifierPattern.test(value)) throw new Error(`${name} contains invalid characters`);
}

function validateDisplayName(value: string, name: string): void {
  if (value.trim() !== value || value.length === 0 || value.length > maximumDisplayNameLength || unsafeDisplayNamePattern.test(value)) {
    throw new Error(`${name} contains invalid characters`);
  }
}

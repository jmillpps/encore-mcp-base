import assert from "node:assert/strict";
import test from "node:test";

const optionsModule = await import(new URL("../../ci/cdk/scripts/runtime-parameter-options.ts", import.meta.url).href) as {
  parseRuntimeParameterOptions: (args: string[], env?: NodeJS.ProcessEnv) => {
    stackName: string;
    actionsClientId: string;
    actionsDisplayName: string;
    actionsRedirectUris: string[];
    mcpClientId: string;
    mcpDisplayName: string;
    mcpRedirectUris: string[];
  };
};

test("runtime parameter options require operator supplied client IDs", () => {
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWithout("--actions-client-id")), /--actions-client-id is required/);
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWithout("--mcp-client-id")), /--mcp-client-id is required/);
});

test("runtime parameter options require an explicit stack name", () => {
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWithout("--stack-name"), {}), /CDK_STACK_NAME is required/);
  assert.equal(optionsModule.parseRuntimeParameterOptions(argsWithout("--stack-name"), { CDK_STACK_NAME: "EnvStack" }).stackName, "EnvStack");
});

test("runtime parameter options accept explicit deployment identifiers", () => {
  const options = optionsModule.parseRuntimeParameterOptions([
    "--stack-name",
    "OperatorStack",
    "--actions-client-id",
    "actions.client:primary",
    "--actions-display-name",
    "Operator Actions",
    "--actions-redirect-uri",
    "https://chatgpt.com/aip/g-prod/oauth/callback",
    "--mcp-client-id",
    "mcp.client:primary",
    "--mcp-display-name",
    "Operator MCP",
    "--mcp-redirect-uri",
    "https://chatgpt.com/connector/oauth/local-callback",
  ]);
  assert.equal(options.stackName, "OperatorStack");
  assert.equal(options.actionsClientId, "actions.client:primary");
  assert.equal(options.actionsDisplayName, "Operator Actions");
  assert.deepEqual(options.actionsRedirectUris, ["https://chatgpt.com/aip/g-prod/oauth/callback"]);
  assert.equal(options.mcpClientId, "mcp.client:primary");
  assert.equal(options.mcpDisplayName, "Operator MCP");
  assert.deepEqual(options.mcpRedirectUris, ["https://chatgpt.com/connector/oauth/local-callback"]);
});

test("runtime parameter options reject malformed client IDs and display names", () => {
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWith("--actions-client-id", "bad id")), /--actions-client-id contains invalid characters/);
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWith("--mcp-client-id", "bad/id")), /--mcp-client-id contains invalid characters/);
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWith("--actions-display-name", " Bad")), /--actions-display-name contains invalid characters/);
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWith("--mcp-display-name", "Bad\nName")), /--mcp-display-name contains invalid characters/);
});

test("runtime parameter options require redirect URIs", () => {
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWithout("--actions-redirect-uri")), /--actions-redirect-uri is required/);
  assert.throws(() => optionsModule.parseRuntimeParameterOptions(argsWithout("--mcp-redirect-uri")), /--mcp-redirect-uri is required/);
});

function baseArgs(): string[] {
  return [
    "--stack-name",
    "OperatorStack",
    "--actions-client-id",
    "actions-client",
    "--actions-redirect-uri",
    "https://chatgpt.com/aip/g-prod/oauth/callback",
    "--mcp-client-id",
    "mcp-client",
    "--mcp-redirect-uri",
    "https://chatgpt.com/connector/oauth/local-callback",
  ];
}

function argsWithout(name: string): string[] {
  const args = baseArgs();
  const index = args.indexOf(name);
  if (index >= 0) args.splice(index, 2);
  return args;
}

function argsWith(name: string, value: string): string[] {
  const args = baseArgs();
  const index = args.indexOf(name);
  if (index >= 0) args[index + 1] = value;
  else args.push(name, value);
  return args;
}

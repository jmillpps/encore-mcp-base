#!/usr/bin/env node
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { awsJson, awsText, putSecureParameter } from "./aws.ts";
import { parseRuntimeParameterOptions } from "./runtime-parameter-options.ts";
import { stackOutputs } from "./stack-outputs.ts";

const options = parseRuntimeParameterOptions(process.argv.slice(2));
const outputs = await stackOutputs(options.stackName);
const prefix = requiredOutput(outputs, "ParameterPrefix");
const keyId = requiredOutput(outputs, "ParameterKeyId");
const actionsAudience = requiredOutput(outputs, "ActionsAudience");
const mcpResource = requiredOutput(outputs, "McpResourceUrl");
const identityProviderMode = requiredOutput(outputs, "IdentityProviderMode");
const upstreamOidcClientId = requiredOutput(outputs, "UpstreamOidcClientId");
const actionsSecret = await existingSecure(prefix, "CHATGPT_ACTIONS_CLIENT_SECRET") ?? randomToken(32);
const mcpSecret = await existingSecure(prefix, "CHATGPT_MCP_CLIENT_SECRET") ?? randomToken(32);
const privateKeyPem = await existingSecure(prefix, "OAUTH_PRIVATE_KEY_PEM") ?? generatePrivateKeyPem();
const keyName = sha256(privateKeyPem).slice(0, 24);

await writeExternalUpstreamSecret(prefix, keyId, identityProviderMode);
await putSecure(prefix, keyId, "OAUTH_PRIVATE_KEY_PEM", privateKeyPem);
await putString(prefix, "OAUTH_KEY_ID", keyName);
await putSecure(prefix, keyId, "CHATGPT_ACTIONS_CLIENT_SECRET", actionsSecret);
await putSecure(prefix, keyId, "CHATGPT_MCP_CLIENT_SECRET", mcpSecret);
await putSecure(prefix, keyId, "OAUTH_CLIENTS_JSON", JSON.stringify([
  {
    clientId: options.actionsClientId,
    clientSecretHash: sha256(actionsSecret),
    displayName: options.actionsDisplayName,
    redirectUris: options.actionsRedirectUris,
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: [actionsAudience],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "optional",
    clientClass: "gpt-actions",
  },
  {
    clientId: options.mcpClientId,
    clientSecretHash: sha256(mcpSecret),
    displayName: options.mcpDisplayName,
    redirectUris: options.mcpRedirectUris,
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: [mcpResource],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "required",
    clientClass: "gpt-apps-mcp",
  },
]));

console.log(JSON.stringify({
  parameterPrefix: prefix,
  keyId,
  actionsClientId: options.actionsClientId,
  actionsClientSecretParameter: `${prefix}/CHATGPT_ACTIONS_CLIENT_SECRET`,
  mcpClientId: options.mcpClientId,
  mcpClientSecretParameter: `${prefix}/CHATGPT_MCP_CLIENT_SECRET`,
  identityProviderMode,
  upstreamOidcClientId,
  upstreamOidcClientSecretSource: identityProviderMode === "cognito" ? "cdk-deploy" : "seed-parameters",
}, null, 2));

function requiredOutput(outputs: Record<string, string>, name: string): string {
  const value = outputs[name];
  if (!value) throw new Error(`missing stack output ${name}`);
  return value;
}

async function writeExternalUpstreamSecret(prefix: string, keyId: string, mode: string): Promise<void> {
  if (mode === "external") {
    const value = process.env.CDK_UPSTREAM_OIDC_CLIENT_SECRET?.trim();
    if (!value) throw new Error("CDK_UPSTREAM_OIDC_CLIENT_SECRET is required for external identity provider mode");
    if (/[\r\n]/.test(value)) throw new Error("CDK_UPSTREAM_OIDC_CLIENT_SECRET cannot include line breaks");
    await putSecure(prefix, keyId, "UPSTREAM_OIDC_CLIENT_SECRET", value);
    return;
  }
  if (mode === "cognito") return;
  throw new Error("IdentityProviderMode output must be external or cognito");
}

async function putString(prefix: string, name: string, value: string): Promise<void> {
  await awsText(["ssm", "put-parameter", "--name", `${prefix}/${name}`, "--type", "String", "--value", value, "--overwrite"]);
}

async function putSecure(prefix: string, keyId: string, name: string, value: string): Promise<void> {
  await putSecureParameter({ name: `${prefix}/${name}`, keyId, value });
}

async function existingSecure(prefix: string, name: string): Promise<string | undefined> {
  try {
    const response = await awsJson(["ssm", "get-parameter", "--name", `${prefix}/${name}`, "--with-decryption"]);
    const value = (response as { Parameter?: { Value?: unknown } }).Parameter?.Value;
    if (typeof value !== "string" || value.length === 0) throw new Error(`${name} parameter value is invalid`);
    return value;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ParameterNotFound")) return undefined;
    throw error;
  }
}

function generatePrivateKeyPem(): string {
  return generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

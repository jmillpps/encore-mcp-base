#!/usr/bin/env node
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { awsJson, awsText } from "./aws.ts";
import { stackOutputs } from "./stack-outputs.ts";

interface Options {
  stackName: string;
  actionsRedirectUris: string[];
  mcpRedirectUris: string[];
  staticUser: StaticUserInput;
}

interface StaticUserInput {
  sub: string;
  givenName: string;
  familyName: string;
  name: string;
  preferredUsername: string;
  email: string;
  emailVerified: string;
}

const options = parseArgs(process.argv.slice(2));
const outputs = await stackOutputs(options.stackName);
const prefix = requiredOutput(outputs, "ParameterPrefix");
const keyId = requiredOutput(outputs, "ParameterKeyId");
const actionsAudience = requiredOutput(outputs, "ActionsAudience");
const mcpResource = requiredOutput(outputs, "McpResourceUrl");
const cognitoUserPoolId = requiredOutput(outputs, "CognitoUserPoolId");
const cognitoClientId = requiredOutput(outputs, "CognitoClientId");
const cognitoSecret = await cognitoClientSecret(cognitoUserPoolId, cognitoClientId);
const actionsSecret = randomToken(32);
const mcpSecret = randomToken(32);
const privateKeyPem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const keyName = sha256(privateKeyPem).slice(0, 24);

await putSecure(prefix, keyId, "OAUTH_PRIVATE_KEY_PEM", privateKeyPem);
await putString(prefix, "OAUTH_KEY_ID", keyName);
await putSecure(prefix, keyId, "COGNITO_CLIENT_SECRET", cognitoSecret);
await putSecure(prefix, keyId, "CHATGPT_ACTIONS_CLIENT_SECRET", actionsSecret);
await putSecure(prefix, keyId, "CHATGPT_MCP_CLIENT_SECRET", mcpSecret);
await putSecure(prefix, keyId, "STATIC_USER_SUB", options.staticUser.sub);
await putSecure(prefix, keyId, "STATIC_USER_GIVEN_NAME", options.staticUser.givenName);
await putSecure(prefix, keyId, "STATIC_USER_FAMILY_NAME", options.staticUser.familyName);
await putSecure(prefix, keyId, "STATIC_USER_NAME", options.staticUser.name);
await putSecure(prefix, keyId, "STATIC_USER_PREFERRED_USERNAME", options.staticUser.preferredUsername);
await putSecure(prefix, keyId, "STATIC_USER_EMAIL", options.staticUser.email);
await putSecure(prefix, keyId, "STATIC_USER_EMAIL_VERIFIED", options.staticUser.emailVerified);
await putSecure(prefix, keyId, "OAUTH_CLIENTS_JSON", JSON.stringify([
  {
    clientId: "gpt-actions-prod",
    clientSecretHash: sha256(actionsSecret),
    displayName: "GPT Actions Production",
    redirectUris: options.actionsRedirectUris,
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: [actionsAudience],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "required",
    clientClass: "gpt-actions",
  },
  {
    clientId: "gpt-apps-mcp-prod",
    clientSecretHash: sha256(mcpSecret),
    displayName: "GPT Apps MCP Production",
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
  actionsClientId: "gpt-actions-prod",
  actionsClientSecretParameter: `${prefix}/CHATGPT_ACTIONS_CLIENT_SECRET`,
  mcpClientId: "gpt-apps-mcp-prod",
  mcpClientSecretParameter: `${prefix}/CHATGPT_MCP_CLIENT_SECRET`,
  cognitoClientId,
}, null, 2));

function parseArgs(args: string[]): Options {
  const parsed = {
    stackName: "GptMcpServiceProd",
    actionsRedirectUris: [] as string[],
    mcpRedirectUris: [] as string[],
    staticUser: {} as Partial<StaticUserInput>,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--stack-name") parsed.stackName = requiredArg(args, (index += 1), arg);
    else if (arg === "--actions-redirect-uri") parsed.actionsRedirectUris.push(requiredArg(args, (index += 1), arg));
    else if (arg === "--mcp-redirect-uri") parsed.mcpRedirectUris.push(requiredArg(args, (index += 1), arg));
    else if (arg === "--static-user-sub") parsed.staticUser.sub = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-given-name") parsed.staticUser.givenName = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-family-name") parsed.staticUser.familyName = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-name") parsed.staticUser.name = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-preferred-username") parsed.staticUser.preferredUsername = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-email") parsed.staticUser.email = requiredArg(args, (index += 1), arg);
    else if (arg === "--static-user-email-verified") parsed.staticUser.emailVerified = requiredArg(args, (index += 1), arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (parsed.actionsRedirectUris.length === 0) throw new Error("--actions-redirect-uri is required");
  if (parsed.mcpRedirectUris.length === 0) throw new Error("--mcp-redirect-uri is required");
  return {
    stackName: parsed.stackName,
    actionsRedirectUris: parsed.actionsRedirectUris,
    mcpRedirectUris: parsed.mcpRedirectUris,
    staticUser: {
      sub: requiredProfileValue(parsed.staticUser.sub ?? process.env.STATIC_USER_SUB, "STATIC_USER_SUB", "--static-user-sub"),
      givenName: requiredProfileValue(parsed.staticUser.givenName ?? process.env.STATIC_USER_GIVEN_NAME, "STATIC_USER_GIVEN_NAME", "--static-user-given-name"),
      familyName: requiredProfileValue(parsed.staticUser.familyName ?? process.env.STATIC_USER_FAMILY_NAME, "STATIC_USER_FAMILY_NAME", "--static-user-family-name"),
      name: requiredProfileValue(parsed.staticUser.name ?? process.env.STATIC_USER_NAME, "STATIC_USER_NAME", "--static-user-name"),
      preferredUsername: requiredProfileValue(parsed.staticUser.preferredUsername ?? process.env.STATIC_USER_PREFERRED_USERNAME, "STATIC_USER_PREFERRED_USERNAME", "--static-user-preferred-username"),
      email: requiredEmail(parsed.staticUser.email ?? process.env.STATIC_USER_EMAIL),
      emailVerified: requiredBoolean(parsed.staticUser.emailVerified ?? process.env.STATIC_USER_EMAIL_VERIFIED, "STATIC_USER_EMAIL_VERIFIED", "--static-user-email-verified"),
    },
  };
}

function requiredArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function requiredProfileValue(value: string | undefined, envName: string, optionName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${optionName} or ${envName} is required`);
  if (trimmed.length > 256) throw new Error(`${envName} must be at most 256 characters`);
  if (/[\r\n]/.test(trimmed)) throw new Error(`${envName} cannot contain line breaks`);
  return trimmed;
}

function requiredEmail(value: string | undefined): string {
  const email = requiredProfileValue(value, "STATIC_USER_EMAIL", "--static-user-email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("STATIC_USER_EMAIL must be an email address");
  return email;
}

function requiredBoolean(value: string | undefined, envName: string, optionName: string): string {
  const trimmed = requiredProfileValue(value, envName, optionName);
  if (trimmed === "true" || trimmed === "false") return trimmed;
  throw new Error(`${envName} must be true or false`);
}

function requiredOutput(outputs: Record<string, string>, name: string): string {
  const value = outputs[name];
  if (!value) throw new Error(`missing stack output ${name}`);
  return value;
}

async function cognitoClientSecret(userPoolId: string, clientId: string): Promise<string> {
  const response = await awsJson(["cognito-idp", "describe-user-pool-client", "--user-pool-id", userPoolId, "--client-id", clientId]);
  const client = (response as { UserPoolClient?: { ClientSecret?: string } }).UserPoolClient;
  if (!client?.ClientSecret) throw new Error("Cognito client secret missing");
  return client.ClientSecret;
}

async function putString(prefix: string, name: string, value: string): Promise<void> {
  await awsText(["ssm", "put-parameter", "--name", `${prefix}/${name}`, "--type", "String", "--value", value, "--overwrite"]);
}

async function putSecure(prefix: string, keyId: string, name: string, value: string): Promise<void> {
  await awsText(["ssm", "put-parameter", "--name", `${prefix}/${name}`, "--type", "SecureString", "--key-id", keyId, "--value", value, "--overwrite"]);
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

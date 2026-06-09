import { awsJson, putSecureParameter } from "./aws.ts";
import { stackName } from "../src/config.ts";
import { stackOutputs, type StackOutputs } from "./stack-outputs.ts";

export interface GeneratedRuntimeParameterSyncResult {
  identityProviderMode: string;
  writtenParameters: string[];
}

export interface GeneratedRuntimeParameterDependencies {
  stackOutputs: (name: string) => Promise<StackOutputs>;
  awsJson: (args: string[]) => Promise<unknown>;
  putSecureParameter: (input: { name: string; keyId: string; value: string }) => Promise<void>;
}

export async function syncGeneratedRuntimeParameters(
  rawStackName: string,
  dependencies: GeneratedRuntimeParameterDependencies = defaultDependencies,
): Promise<GeneratedRuntimeParameterSyncResult> {
  const name = stackName(rawStackName);
  const outputs = await dependencies.stackOutputs(name);
  return syncGeneratedRuntimeParametersFromOutputs(outputs, dependencies);
}

export async function syncGeneratedRuntimeParametersFromOutputs(
  outputs: StackOutputs,
  dependencies: Pick<GeneratedRuntimeParameterDependencies, "awsJson" | "putSecureParameter"> = defaultDependencies,
): Promise<GeneratedRuntimeParameterSyncResult> {
  const mode = requiredOutput(outputs, "IdentityProviderMode");
  if (mode === "external") return { identityProviderMode: mode, writtenParameters: [] };
  if (mode !== "cognito") throw new Error("IdentityProviderMode output must be external or cognito");
  const parameterName = `${requiredOutput(outputs, "ParameterPrefix")}/UPSTREAM_OIDC_CLIENT_SECRET`;
  const response = await dependencies.awsJson([
    "cognito-idp",
    "describe-user-pool-client",
    "--user-pool-id",
    requiredOutput(outputs, "CognitoUserPoolId"),
    "--client-id",
    requiredOutput(outputs, "CognitoClientId"),
  ]);
  await dependencies.putSecureParameter({
    name: parameterName,
    keyId: requiredOutput(outputs, "ParameterKeyId"),
    value: cognitoClientSecret(response),
  });
  return { identityProviderMode: mode, writtenParameters: [parameterName] };
}

const defaultDependencies: GeneratedRuntimeParameterDependencies = {
  stackOutputs,
  awsJson,
  putSecureParameter,
};

function cognitoClientSecret(response: unknown): string {
  const client = asRecord(asRecord(response).UserPoolClient);
  const secret = client.ClientSecret;
  if (typeof secret !== "string" || secret.length === 0) throw new Error("Cognito client secret missing");
  return secret;
}

function requiredOutput(outputs: StackOutputs, name: string): string {
  const value = outputs[name];
  if (!value) throw new Error(`missing stack output ${name}`);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");
  return value as Record<string, unknown>;
}

import assert from "node:assert/strict";
import test from "node:test";

type SyncModule = {
  syncGeneratedRuntimeParametersFromOutputs: (
    outputs: Record<string, string>,
    dependencies: {
      awsJson: (args: string[]) => Promise<unknown>;
      putSecureParameter: (input: { name: string; keyId: string; value: string }) => Promise<void>;
    },
  ) => Promise<{ identityProviderMode: string; writtenParameters: string[] }>;
};

const generated = await import(new URL("../../ci/cdk/scripts/generated-runtime-parameters.ts", import.meta.url).href) as SyncModule;

test("generated runtime sync writes Cognito client secret to current upstream parameter", async () => {
  const awsCalls: string[][] = [];
  const writes: Array<{ name: string; keyId: string; value: string }> = [];
  const result = await generated.syncGeneratedRuntimeParametersFromOutputs(cognitoOutputs(), {
    awsJson: async (args) => {
      awsCalls.push(args);
      return { UserPoolClient: { ClientSecret: "generated-secret" } };
    },
    putSecureParameter: async (input) => {
      writes.push(input);
    },
  });

  assert.deepEqual(awsCalls, [[
    "cognito-idp",
    "describe-user-pool-client",
    "--user-pool-id",
    "user-pool-id",
    "--client-id",
    "client-id",
  ]]);
  assert.deepEqual(writes, [{
    name: "/operator-mcp/sandbox/env/UPSTREAM_OIDC_CLIENT_SECRET",
    keyId: "parameter-key-id",
    value: "generated-secret",
  }]);
  assert.deepEqual(result, {
    identityProviderMode: "cognito",
    writtenParameters: ["/operator-mcp/sandbox/env/UPSTREAM_OIDC_CLIENT_SECRET"],
  });
  assert.equal(JSON.stringify(result).includes("generated-secret"), false);
});

test("generated runtime sync leaves external upstream secret operator managed", async () => {
  const result = await generated.syncGeneratedRuntimeParametersFromOutputs({
    ...cognitoOutputs(),
    IdentityProviderMode: "external",
  }, {
    awsJson: async () => {
      throw new Error("unexpected awsJson call");
    },
    putSecureParameter: async () => {
      throw new Error("unexpected putSecureParameter call");
    },
  });

  assert.deepEqual(result, { identityProviderMode: "external", writtenParameters: [] });
});

test("generated runtime sync requires Cognito secret in AWS response", async () => {
  await assert.rejects(() => generated.syncGeneratedRuntimeParametersFromOutputs(cognitoOutputs(), {
    awsJson: async () => ({ UserPoolClient: {} }),
    putSecureParameter: async () => {},
  }), /Cognito client secret missing/);
});

function cognitoOutputs(): Record<string, string> {
  return {
    IdentityProviderMode: "cognito",
    ParameterPrefix: "/operator-mcp/sandbox/env",
    ParameterKeyId: "parameter-key-id",
    CognitoUserPoolId: "user-pool-id",
    CognitoClientId: "client-id",
  };
}

import assert from "node:assert/strict";
import test from "node:test";

interface DeploymentConfig {
  appName: string;
  environmentName: string;
  awsResourceName: string;
  serviceName: string;
  stackName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  identityProvider: {
    mode: "external";
    upstreamOidc: {
      issuerUrl: string;
      discoveryUrl: string;
      authorizationUrl: string;
      tokenUrl: string;
      userinfoUrl: string;
      clientId: string;
      scopes: string;
      tokenAuthMethod: "client_secret_post";
    };
  };
  parameterPrefix: string;
  instanceType: string;
  allowedOrigins: string;
  widgetDomain: string;
}

type TemplateJson = { Resources: Record<string, { Type?: string; Properties?: Record<string, unknown> }> };
type TestTemplate = { toJSON: () => TemplateJson };

const cdk = await import(new URL("../../ci/cdk/node_modules/aws-cdk-lib/index.js", import.meta.url).href) as { App: new () => unknown };
const assertions = await import(new URL("../../ci/cdk/node_modules/aws-cdk-lib/assertions/index.js", import.meta.url).href) as {
  Template: { fromStack: (stack: unknown) => TestTemplate };
};
const stackModule = await import(new URL("../../ci/cdk/src/mcp-service-stack.ts", import.meta.url).href) as {
  McpServiceStack: new (scope: never, id: string, props: { config: DeploymentConfig }) => unknown;
};

test("CDK provisions one encrypted DynamoDB state table without secondary indexes", () => {
  const table = onlyResource(template(), "AWS::DynamoDB::Table");
  assert.equal(table.BillingMode, "PAY_PER_REQUEST");
  assert.deepEqual(table.KeySchema, [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ]);
  assert.equal("GlobalSecondaryIndexes" in table, false);
  assert.equal("LocalSecondaryIndexes" in table, false);
  assert.deepEqual(table.TimeToLiveSpecification, { AttributeName: "ttl", Enabled: true });
  assert.deepEqual(table.PointInTimeRecoverySpecification, { PointInTimeRecoveryEnabled: true });
  assert.equal(table.DeletionProtectionEnabled, true);
  const sse = table.SSESpecification as Record<string, unknown>;
  assert.equal(sse.SSEEnabled, true);
  assert.equal(sse.SSEType, "KMS");
  assert.ok(sse.KMSMasterKeyId);
});

test("CDK writes DynamoDB runtime parameters and scoped instance permissions", () => {
  const synthesized = template();
  const parameters = parameterMap(synthesized);
  assert.equal(parameters.get("/operator-mcp/sandbox/env/OAUTH_STORE_BACKEND"), "dynamodb");
  assert.ok(parameters.has("/operator-mcp/sandbox/env/OAUTH_DYNAMODB_TABLE_NAME"));
  assert.ok(parameters.has("/operator-mcp/sandbox/env/OAUTH_DYNAMODB_REGION"));
  assert.equal(parameters.has("/operator-mcp/sandbox/env/OAUTH_STORE_PATH"), false);
  const policyActions = JSON.stringify(synthesized.Resources);
  assert.match(policyActions, /dynamodb:GetItem/);
  assert.match(policyActions, /dynamodb:TransactWriteItems/);
  assert.equal(policyActions.includes("dynamodb:Query"), false);
  assert.equal(policyActions.includes("dynamodb:Scan"), false);
});

function template(): TemplateJson {
  const app = new cdk.App() as never;
  const stack = new stackModule.McpServiceStack(app, "TestStack", { config: config() });
  return assertions.Template.fromStack(stack).toJSON();
}

function onlyResource(templateJson: TemplateJson, type: string): Record<string, unknown> {
  const matches = Object.values(templateJson.Resources).filter((resource) => resource.Type === type);
  assert.equal(matches.length, 1);
  return matches[0]?.Properties ?? {};
}

function parameterMap(templateJson: TemplateJson): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const resource of Object.values(templateJson.Resources)) {
    if (resource.Type === "AWS::SSM::Parameter" && typeof resource.Properties?.Name === "string") {
      result.set(resource.Properties.Name, resource.Properties.Value);
    }
  }
  return result;
}

function config(): DeploymentConfig {
  return {
    appName: "operator-mcp",
    environmentName: "sandbox",
    awsResourceName: "operator-mcp-sandbox",
    serviceName: "operator-runtime",
    stackName: "OperatorMcpSandbox",
    domainName: "service.example.com",
    hostedZoneId: "EXAMPLEZONE",
    hostedZoneName: "example.com",
    parameterPrefix: "/operator-mcp/sandbox/env",
    instanceType: "t4g.micro",
    allowedOrigins: "https://chatgpt.com https://chat.openai.com",
    widgetDomain: "https://widgets.example.test",
    identityProvider: {
      mode: "external",
      upstreamOidc: {
        issuerUrl: "https://idp.example.test",
        discoveryUrl: "https://idp.example.test/.well-known/openid-configuration",
        authorizationUrl: "https://login.example.test/oauth2/authorize",
        tokenUrl: "https://login.example.test/oauth2/token",
        userinfoUrl: "https://login.example.test/oauth2/userInfo",
        clientId: "upstream-client",
        scopes: "openid profile email",
        tokenAuthMethod: "client_secret_post",
      },
    },
  };
}

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
    mode: "external" | "cognito";
    cognitoDomainPrefix?: string;
    upstreamOidc?: {
      issuerUrl: string;
      discoveryUrl: string;
      authorizationUrl: string;
      tokenUrl: string;
      userinfoUrl: string;
      clientId: string;
      scopes: string;
      tokenAuthMethod: "client_secret_post" | "client_secret_basic";
    };
  };
  parameterPrefix: string;
  instanceType: string;
  allowedOrigins: string;
  widgetDomain: string;
}

type TestTemplate = {
  resourceCountIs: (type: string, count: number) => void;
  hasResourceProperties: (type: string, properties: Record<string, unknown>) => void;
  toJSON: () => { Resources: Record<string, { Type?: string; Properties?: { Name?: string; Value?: unknown } }> };
};

const cdk = await import(new URL("../../ci/cdk/node_modules/aws-cdk-lib/index.js", import.meta.url).href) as { App: new () => unknown };
const assertions = await import(new URL("../../ci/cdk/node_modules/aws-cdk-lib/assertions/index.js", import.meta.url).href) as {
  Template: { fromStack: (stack: unknown) => TestTemplate };
};
const stackModule = await import(new URL("../../ci/cdk/src/mcp-service-stack.ts", import.meta.url).href) as {
  McpServiceStack: new (scope: never, id: string, props: { config: DeploymentConfig }) => unknown;
};

test("CDK external identity provider mode writes generic upstream OIDC parameters", () => {
  const template = assertions.Template.fromStack(stack(externalConfig()));
  template.resourceCountIs("AWS::Cognito::UserPool", 0);
  const parameters = parameterMap(template);
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_ISSUER_URL"), "https://idp.example.test");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_DISCOVERY_URL"), "https://idp.example.test/.well-known/openid-configuration");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_CLIENT_ID"), "upstream-client");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_REDIRECT_URI"), "https://service.example.com/oauth/callback");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_TOKEN_AUTH_METHOD"), "client_secret_basic");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/WIDGET_DOMAIN"), "https://widgets.example.test");
  assert.equal([...parameters.keys()].some((name) => name.includes("COGNITO_")), false);
});

test("CDK Cognito identity provider mode provisions Cognito and still writes upstream OIDC parameters", () => {
  const template = assertions.Template.fromStack(stack(cognitoConfig()));
  template.resourceCountIs("AWS::Cognito::UserPool", 1);
  template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
    CallbackURLs: ["https://service.example.com/oauth/callback"],
  });
  const parameters = parameterMap(template);
  assert.ok(parameters.has("/operator-mcp/sandbox/env/UPSTREAM_OIDC_ISSUER_URL"));
  assert.ok(parameters.has("/operator-mcp/sandbox/env/UPSTREAM_OIDC_DISCOVERY_URL"));
  assert.ok(parameters.has("/operator-mcp/sandbox/env/UPSTREAM_OIDC_CLIENT_ID"));
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_REDIRECT_URI"), "https://service.example.com/oauth/callback");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/UPSTREAM_OIDC_TOKEN_AUTH_METHOD"), "client_secret_post");
  assert.equal(parameters.get("/operator-mcp/sandbox/env/WIDGET_DOMAIN"), "https://widgets.example.test");
  assert.equal([...parameters.keys()].some((name) => name.includes("COGNITO_")), false);
});

function stack(config: DeploymentConfig): unknown {
  return new stackModule.McpServiceStack(new cdk.App() as never, "TestStack", { config });
}

function externalConfig(): DeploymentConfig {
  return {
    ...baseConfig(),
    identityProvider: {
      mode: "external",
      upstreamOidc: {
        issuerUrl: "https://idp.example.test",
        discoveryUrl: "https://idp.example.test/.well-known/openid-configuration",
        authorizationUrl: "https://login.example.test/oauth2/authorize",
        tokenUrl: "https://login.example.test/oauth2/token",
        userinfoUrl: "https://login.example.test/oauth2/userInfo",
        clientId: "upstream-client",
        scopes: "openid profile email custom:read",
        tokenAuthMethod: "client_secret_basic",
      },
    },
  };
}

function cognitoConfig(): DeploymentConfig {
  return {
    ...baseConfig(),
    identityProvider: { mode: "cognito", cognitoDomainPrefix: "operator-mcp-sandbox" },
  };
}

function baseConfig(): Omit<DeploymentConfig, "identityProvider"> {
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
  };
}

function parameterMap(template: TestTemplate): Map<string, unknown> {
  const resources = template.toJSON().Resources;
  const result = new Map<string, unknown>();
  for (const resource of Object.values(resources)) {
    if (resource.Type === "AWS::SSM::Parameter" && typeof resource.Properties?.Name === "string") {
      result.set(resource.Properties.Name, resource.Properties.Value);
    }
  }
  return result;
}

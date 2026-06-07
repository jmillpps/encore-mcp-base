import assert from "node:assert/strict";
import test from "node:test";

type UserDataModule = {
  oauthStorePath: (resourceName: string) => string;
  userDataCommands: (input: {
    config: {
      appName: string;
      environmentName: string;
      resourceName: string;
      stackName: string;
      domainName: string;
      hostedZoneId: string;
      hostedZoneName: string;
      cognitoDomainPrefix: string;
      parameterPrefix: string;
      instanceType: string;
      allowedOrigins: string;
    };
    region: string;
    repositoryUri: string;
  }) => string[];
};

const userData = await import(new URL("../../ci/cdk/src/user-data.ts", import.meta.url).href) as UserDataModule;

test("user data derives instance runtime placement from operator resource name", () => {
  const commands = userData.userDataCommands({
    config: {
      appName: "operator-mcp",
      environmentName: "sandbox",
      resourceName: "operator-mcp-sandbox",
      stackName: "OperatorMcpSandbox",
      domainName: "service.example.com",
      hostedZoneId: "EXAMPLEZONE",
      hostedZoneName: "example.com",
      cognitoDomainPrefix: "operator-mcp-sandbox",
      parameterPrefix: "/operator-mcp/sandbox/env",
      instanceType: "t4g.micro",
      allowedOrigins: "https://chatgpt.com https://chat.openai.com",
    },
    region: "us-east-1",
    repositoryUri: "123456789012.dkr.ecr.us-east-1.amazonaws.com/operator-mcp-sandbox",
  }).join("\n");

  assert.match(commands, /\/var\/log\/operator-mcp-sandbox-bootstrap\.log/);
  assert.match(commands, /\/opt\/operator-mcp-sandbox\/run\.sh/);
  assert.match(commands, /\/var\/lib\/operator-mcp-sandbox/);
  assert.match(commands, /\/run\/operator-mcp-sandbox/);
  assert.match(commands, /\/etc\/systemd\/system\/operator-mcp-sandbox\.service/);
  assert.match(commands, /docker rm -f operator-mcp-sandbox/);
  assert.match(commands, /docker run -d --name operator-mcp-sandbox/);
  assert.equal(commands.includes("gpt-mcp-service.service"), false);
  assert.equal(commands.includes("/var/lib/gpt-mcp-service"), false);
});

test("OAuth store path derives from operator resource name", () => {
  assert.equal(userData.oauthStorePath("operator-mcp-sandbox"), "/var/lib/operator-mcp-sandbox/oauth-store.json");
});

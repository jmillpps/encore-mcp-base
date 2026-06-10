import assert from "node:assert/strict";
import test from "node:test";

type UserDataModule = {
  userDataCommands: (input: {
    config: {
      appName: string;
      environmentName: string;
      awsResourceName: string;
      serviceName: string;
      stackName: string;
      domainName: string;
      hostedZoneId: string;
      hostedZoneName: string;
      identityProvider: { mode: string };
      parameterPrefix: string;
      instanceType: string;
      allowedOrigins: string;
    };
    region: string;
    repositoryUri: string;
  }) => string[];
};

const userData = await import(new URL("../../ci/cdk/src/user-data.ts", import.meta.url).href) as UserDataModule;

test("user data derives instance runtime placement from operator service name", () => {
  const commands = userData.userDataCommands({
    config: {
      appName: "operator-mcp",
      environmentName: "sandbox",
      awsResourceName: "operator-mcp-sandbox",
      serviceName: "operator-runtime",
      stackName: "OperatorMcpSandbox",
      domainName: "service.example.com",
      hostedZoneId: "EXAMPLEZONE",
      hostedZoneName: "example.com",
      identityProvider: { mode: "external" },
      parameterPrefix: "/operator-mcp/sandbox/env",
      instanceType: "t4g.micro",
      allowedOrigins: "https://chatgpt.com https://chat.openai.com",
    },
    region: "us-east-1",
    repositoryUri: "registry.example.test/operator-mcp-sandbox",
  }).join("\n");

  assert.match(commands, /\/var\/log\/operator-runtime-bootstrap\.log/);
  assert.match(commands, /\/opt\/operator-runtime\/run\.sh/);
  assert.match(commands, /\/var\/lib\/operator-runtime/);
  assert.match(commands, /\/run\/operator-runtime/);
  assert.match(commands, /AWS_REGION=%s/);
  assert.match(commands, /AWS_DEFAULT_REGION=%s/);
  assert.match(commands, /\/etc\/systemd\/system\/operator-runtime\.service/);
  assert.match(commands, /docker rm -f operator-runtime/);
  assert.match(commands, /docker run -d --name operator-runtime/);
  assert.equal(commands.includes("gpt-mcp-service.service"), false);
  assert.equal(commands.includes("/var/lib/gpt-mcp-service"), false);
});

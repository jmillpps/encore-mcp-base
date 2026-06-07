import assert from "node:assert/strict";
import test from "node:test";

type DeploymentConfigReader = (env: NodeJS.ProcessEnv) => {
  stackName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  cognitoDomainPrefix: string;
  parameterPrefix: string;
};

type DeploymentStackNameReader = (env: NodeJS.ProcessEnv) => string;

const cdkConfig = await import(new URL("../../ci/cdk/src/config.ts", import.meta.url).href) as {
  deploymentConfig: DeploymentConfigReader;
  deploymentStackName: DeploymentStackNameReader;
};

test("deployment config requires operator-owned DNS and Cognito inputs", () => {
  assert.throws(() => cdkConfig.deploymentConfig({}), /CDK_DOMAIN_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_HOSTED_ZONE_ID: "" })), /CDK_HOSTED_ZONE_ID is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_COGNITO_DOMAIN_PREFIX: "" })), /CDK_COGNITO_DOMAIN_PREFIX is required/);
});

test("deployment config accepts explicit deployment inputs", () => {
  const config = cdkConfig.deploymentConfig(baseEnv({
    CDK_APP_NAME: "example-service",
    CDK_ENVIRONMENT_NAME: "sandbox",
  }));
  assert.equal(config.domainName, "service.example.com");
  assert.equal(config.hostedZoneId, "example-zone-id");
  assert.equal(config.hostedZoneName, "example.com");
  assert.equal(config.cognitoDomainPrefix, "service-example-prod");
  assert.equal(config.parameterPrefix, "/example-service/sandbox/env");
  assert.equal(config.stackName, "ExampleServiceSandbox");
});

test("deployment config accepts an explicit stack name", () => {
  const config = cdkConfig.deploymentConfig(baseEnv({ CDK_STACK_NAME: "OperatorOwnedStack" }));
  assert.equal(config.stackName, "OperatorOwnedStack");
});

test("deployment stack name can be read without DNS inputs", () => {
  assert.equal(cdkConfig.deploymentStackName({ CDK_APP_NAME: "operator-service", CDK_ENVIRONMENT_NAME: "qa" }), "OperatorServiceQa");
});

function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    CDK_DOMAIN_NAME: "service.example.com",
    CDK_HOSTED_ZONE_ID: "example-zone-id",
    CDK_HOSTED_ZONE_NAME: "example.com",
    CDK_COGNITO_DOMAIN_PREFIX: "service-example-prod",
    ...overrides,
  };
}

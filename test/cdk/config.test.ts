import assert from "node:assert/strict";
import test from "node:test";

type DeploymentConfigReader = (env: NodeJS.ProcessEnv) => {
  appName: string;
  environmentName: string;
  awsResourceName: string;
  serviceName: string;
  stackName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  cognitoDomainPrefix: string;
  parameterPrefix: string;
  instanceType: string;
};

type DeploymentStackNameReader = (env: NodeJS.ProcessEnv) => string;
type StackNameReader = (value: string | undefined) => string;

const cdkConfig = await import(new URL("../../ci/cdk/src/config.ts", import.meta.url).href) as {
  deploymentConfig: DeploymentConfigReader;
  deploymentStackName: DeploymentStackNameReader;
  stackName: StackNameReader;
};

test("deployment config requires operator-owned deployment inputs", () => {
  assert.throws(() => cdkConfig.deploymentConfig({}), /CDK_ENVIRONMENT_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_APP_NAME: "" })), /CDK_APP_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_SERVICE_NAME: "" })), /CDK_SERVICE_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_STACK_NAME: "" })), /CDK_STACK_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_DOMAIN_NAME: "" })), /CDK_DOMAIN_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_HOSTED_ZONE_ID: "" })), /CDK_HOSTED_ZONE_ID is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_COGNITO_DOMAIN_PREFIX: "" })), /CDK_COGNITO_DOMAIN_PREFIX is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_PARAMETER_PREFIX: "" })), /CDK_PARAMETER_PREFIX is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_INSTANCE_TYPE: "" })), /CDK_INSTANCE_TYPE is required/);
});

test("deployment config accepts explicit deployment inputs", () => {
  const config = cdkConfig.deploymentConfig(baseEnv());
  assert.equal(config.appName, "operator-mcp");
  assert.equal(config.environmentName, "sandbox");
  assert.equal(config.awsResourceName, "operator-mcp-sandbox");
  assert.equal(config.serviceName, "operator-runtime");
  assert.equal(config.domainName, "service.example.com");
  assert.equal(config.hostedZoneId, "EXAMPLEZONE");
  assert.equal(config.hostedZoneName, "example.com");
  assert.equal(config.cognitoDomainPrefix, "operator-mcp-sandbox");
  assert.equal(config.parameterPrefix, "/operator-mcp/sandbox/env");
  assert.equal(config.instanceType, "t4g.micro");
  assert.equal(config.stackName, "OperatorMcpSandbox");
});

test("deployment config rejects ambiguous or unsafe deployment inputs", () => {
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_APP_NAME: "OperatorMcp" })), /CDK_APP_NAME contains invalid characters/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_SERVICE_NAME: "operator_runtime" })), /CDK_SERVICE_NAME contains invalid characters/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_DOMAIN_NAME: "service.other.example" })), /CDK_DOMAIN_NAME must be within CDK_HOSTED_ZONE_NAME/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_PARAMETER_PREFIX: "/aws/operator/env" })), /reserved prefix/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_PARAMETER_PREFIX: "/operator/../env" })), /invalid path segments/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_COGNITO_DOMAIN_PREFIX: "operator_mcp" })), /CDK_COGNITO_DOMAIN_PREFIX contains invalid characters/);
});

test("deployment stack name is read only from explicit stack input", () => {
  assert.equal(cdkConfig.deploymentStackName(baseEnv({ CDK_STACK_NAME: "OperatorStack" })), "OperatorStack");
  assert.equal(cdkConfig.stackName("OperatorStack"), "OperatorStack");
  assert.throws(() => cdkConfig.deploymentStackName({ CDK_APP_NAME: "operator-mcp", CDK_ENVIRONMENT_NAME: "qa" }), /CDK_STACK_NAME is required/);
});

function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    CDK_APP_NAME: "operator-mcp",
    CDK_ENVIRONMENT_NAME: "sandbox",
    CDK_SERVICE_NAME: "operator-runtime",
    CDK_STACK_NAME: "OperatorMcpSandbox",
    CDK_DOMAIN_NAME: "service.example.com",
    CDK_HOSTED_ZONE_ID: "EXAMPLEZONE",
    CDK_HOSTED_ZONE_NAME: "example.com",
    CDK_COGNITO_DOMAIN_PREFIX: "operator-mcp-sandbox",
    CDK_PARAMETER_PREFIX: "/operator-mcp/sandbox/env",
    CDK_INSTANCE_TYPE: "t4g.micro",
    ...overrides,
  };
}

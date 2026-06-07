import assert from "node:assert/strict";
import test from "node:test";

type DeploymentConfigReader = (env: NodeJS.ProcessEnv) => {
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  cognitoDomainPrefix: string;
  parameterPrefix: string;
};

const cdkConfig = await import(new URL("../../ci/cdk/src/config.ts", import.meta.url).href) as { deploymentConfig: DeploymentConfigReader };

test("deployment config requires operator-owned DNS and Cognito inputs", () => {
  assert.throws(() => cdkConfig.deploymentConfig({}), /CDK_DOMAIN_NAME is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_HOSTED_ZONE_ID: "" })), /CDK_HOSTED_ZONE_ID is required/);
  assert.throws(() => cdkConfig.deploymentConfig(baseEnv({ CDK_COGNITO_DOMAIN_PREFIX: "" })), /CDK_COGNITO_DOMAIN_PREFIX is required/);
});

test("deployment config accepts explicit deployment inputs", () => {
  const config = cdkConfig.deploymentConfig(baseEnv());
  assert.equal(config.domainName, "service.example.com");
  assert.equal(config.hostedZoneId, "example-zone-id");
  assert.equal(config.hostedZoneName, "example.com");
  assert.equal(config.cognitoDomainPrefix, "service-example-prod");
  assert.equal(config.parameterPrefix, "/gpt-mcp-service/prod/env");
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

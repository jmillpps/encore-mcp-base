import * as cdk from "aws-cdk-lib";
import { deploymentConfig } from "./config.ts";
import { McpServiceStack } from "./mcp-service-stack.ts";

const app = new cdk.App();
const config = deploymentConfig();
const account = requiredEnv(process.env, "CDK_DEFAULT_ACCOUNT");
const region = requiredRegion(process.env);

new McpServiceStack(app, "GptMcpServiceProd", {
  config,
  env: { account, region },
});

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function requiredRegion(env: NodeJS.ProcessEnv): string {
  const value = env.CDK_DEFAULT_REGION ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (!value?.trim()) throw new Error("CDK_DEFAULT_REGION is required");
  return value.trim();
}

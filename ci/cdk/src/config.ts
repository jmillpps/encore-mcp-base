export interface DeploymentConfig {
  appName: string;
  environmentName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  cognitoDomainPrefix: string;
  parameterPrefix: string;
  instanceType: string;
  allowedOrigins: string;
}

export function deploymentConfig(env: NodeJS.ProcessEnv = process.env): DeploymentConfig {
  const environmentName = env.CDK_ENVIRONMENT_NAME ?? "prod";
  const appName = env.CDK_APP_NAME ?? "gpt-mcp-service";
  return {
    appName,
    environmentName,
    domainName: requiredEnv(env, "CDK_DOMAIN_NAME"),
    hostedZoneId: requiredEnv(env, "CDK_HOSTED_ZONE_ID"),
    hostedZoneName: requiredEnv(env, "CDK_HOSTED_ZONE_NAME"),
    cognitoDomainPrefix: requiredEnv(env, "CDK_COGNITO_DOMAIN_PREFIX"),
    parameterPrefix: env.CDK_PARAMETER_PREFIX ?? `/${appName}/${environmentName}/env`,
    instanceType: env.CDK_INSTANCE_TYPE ?? "t4g.micro",
    allowedOrigins: env.CDK_ALLOWED_ORIGINS ?? "https://chatgpt.com https://chat.openai.com",
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

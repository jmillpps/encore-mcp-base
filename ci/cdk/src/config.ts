export interface DeploymentConfig {
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
}

const resourceNamePattern = /^[a-z][a-z0-9-]{0,62}$/;
const dnsLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const stackNamePattern = /^[A-Za-z][A-Za-z0-9-]{0,127}$/;
const hostedZoneIdPattern = /^[A-Z0-9]+$/;
const parameterPrefixPattern = /^\/[A-Za-z0-9_.\-/]+$/;
const instanceTypePattern = /^[a-z0-9][a-z0-9.-]*$/;

export function deploymentConfig(env: NodeJS.ProcessEnv = process.env): DeploymentConfig {
  const environmentName = resourceName(env, "CDK_ENVIRONMENT_NAME");
  const appName = resourceName(env, "CDK_APP_NAME");
  const domainName = dnsName(env, "CDK_DOMAIN_NAME");
  const hostedZoneName = dnsName(env, "CDK_HOSTED_ZONE_NAME");
  assertDomainInHostedZone(domainName, hostedZoneName);
  return {
    appName,
    environmentName,
    resourceName: `${appName}-${environmentName}`,
    stackName: deploymentStackName(env),
    domainName,
    hostedZoneId: hostedZoneId(env),
    hostedZoneName,
    cognitoDomainPrefix: cognitoDomainPrefix(env),
    parameterPrefix: parameterPrefix(env),
    instanceType: instanceType(env),
    allowedOrigins: env.CDK_ALLOWED_ORIGINS ?? "https://chatgpt.com https://chat.openai.com",
  };
}

export function deploymentStackName(env: NodeJS.ProcessEnv = process.env): string {
  return stackName(env.CDK_STACK_NAME);
}

export function stackName(value: string | undefined): string {
  const name = requiredTextValue(value, "CDK_STACK_NAME");
  if (!stackNamePattern.test(name)) throw new Error("CDK_STACK_NAME contains invalid characters");
  return name;
}

function resourceName(env: NodeJS.ProcessEnv, key: string): string {
  const value = requiredEnv(env, key);
  if (!resourceNamePattern.test(value)) throw new Error(`${key} contains invalid characters`);
  return value;
}

function dnsName(env: NodeJS.ProcessEnv, key: string): string {
  const value = requiredEnv(env, key);
  if (value.length > 253 || value.endsWith(".") || value.split(".").length < 2) throw new Error(`${key} must be a hostname`);
  for (const label of value.split(".")) {
    if (!dnsLabelPattern.test(label)) throw new Error(`${key} must be a lowercase hostname`);
  }
  return value;
}

function hostedZoneId(env: NodeJS.ProcessEnv): string {
  const value = requiredEnv(env, "CDK_HOSTED_ZONE_ID");
  if (!hostedZoneIdPattern.test(value)) throw new Error("CDK_HOSTED_ZONE_ID contains invalid characters");
  return value;
}

function cognitoDomainPrefix(env: NodeJS.ProcessEnv): string {
  const value = requiredEnv(env, "CDK_COGNITO_DOMAIN_PREFIX");
  if (!resourceNamePattern.test(value)) throw new Error("CDK_COGNITO_DOMAIN_PREFIX contains invalid characters");
  return value;
}

function parameterPrefix(env: NodeJS.ProcessEnv): string {
  const value = requiredEnv(env, "CDK_PARAMETER_PREFIX");
  if (!parameterPrefixPattern.test(value) || value.endsWith("/") || value.includes("//")) throw new Error("CDK_PARAMETER_PREFIX contains invalid characters");
  if (value.split("/").some((part) => part === "." || part === "..")) throw new Error("CDK_PARAMETER_PREFIX contains invalid path segments");
  if (value.toLowerCase().startsWith("/aws/") || value.toLowerCase().startsWith("/ssm/")) throw new Error("CDK_PARAMETER_PREFIX uses a reserved prefix");
  return value;
}

function instanceType(env: NodeJS.ProcessEnv): string {
  const value = requiredEnv(env, "CDK_INSTANCE_TYPE");
  if (!instanceTypePattern.test(value) || !value.includes(".")) throw new Error("CDK_INSTANCE_TYPE contains invalid characters");
  return value;
}

function assertDomainInHostedZone(domainName: string, hostedZoneName: string): void {
  if (domainName !== hostedZoneName && !domainName.endsWith(`.${hostedZoneName}`)) {
    throw new Error("CDK_DOMAIN_NAME must be within CDK_HOSTED_ZONE_NAME");
  }
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  return requiredTextValue(env[key], key);
}

function requiredTextValue(rawValue: string | undefined, key: string): string {
  const value = rawValue?.trim();
  if (!value) throw new Error(`${key} is required`);
  if (value !== rawValue) throw new Error(`${key} cannot include surrounding whitespace`);
  if (/[\r\n]/.test(value)) throw new Error(`${key} cannot include line breaks`);
  return value;
}

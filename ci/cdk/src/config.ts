export interface DeploymentConfig {
  appName: string;
  environmentName: string;
  awsResourceName: string;
  serviceName: string;
  stackName: string;
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  identityProvider: IdentityProviderConfig;
  parameterPrefix: string;
  instanceType: string;
  allowedOrigins: string;
}

export type IdentityProviderConfig = ExternalIdentityProviderConfig | CognitoIdentityProviderConfig;

export interface ExternalIdentityProviderConfig {
  mode: "external";
  upstreamOidc: UpstreamOidcDeploymentConfig;
}

export interface CognitoIdentityProviderConfig {
  mode: "cognito";
  cognitoDomainPrefix: string;
}

export interface UpstreamOidcDeploymentConfig {
  issuerUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  scopes: string;
  tokenAuthMethod: "client_secret_post" | "client_secret_basic";
}

const resourceNamePattern = /^[a-z][a-z0-9-]{0,62}$/;
const dnsLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const stackNamePattern = /^[A-Za-z][A-Za-z0-9-]{0,127}$/;
const hostedZoneIdPattern = /^[A-Z0-9]+$/;
const parameterPrefixPattern = /^\/[A-Za-z0-9_.\-/]+$/;
const instanceTypePattern = /^[a-z0-9][a-z0-9.-]*$/;
const scopePattern = /^[A-Za-z0-9:_./-]+$/;

export function deploymentConfig(env: NodeJS.ProcessEnv = process.env): DeploymentConfig {
  const environmentName = resourceName(env, "CDK_ENVIRONMENT_NAME");
  const appName = resourceName(env, "CDK_APP_NAME");
  const domainName = dnsName(env, "CDK_DOMAIN_NAME");
  const hostedZoneName = dnsName(env, "CDK_HOSTED_ZONE_NAME");
  assertDomainInHostedZone(domainName, hostedZoneName);
  return {
    appName,
    environmentName,
    awsResourceName: `${appName}-${environmentName}`,
    serviceName: resourceName(env, "CDK_SERVICE_NAME"),
    stackName: deploymentStackName(env),
    domainName,
    hostedZoneId: hostedZoneId(env),
    hostedZoneName,
    identityProvider: identityProvider(env),
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

function identityProvider(env: NodeJS.ProcessEnv): IdentityProviderConfig {
  const mode = requiredEnv(env, "CDK_IDENTITY_PROVIDER_MODE");
  if (mode === "external") return { mode, upstreamOidc: upstreamOidc(env) };
  if (mode === "cognito") return { mode, cognitoDomainPrefix: cognitoDomainPrefix(env) };
  throw new Error("CDK_IDENTITY_PROVIDER_MODE must be external or cognito");
}

function cognitoDomainPrefix(env: NodeJS.ProcessEnv): string {
  const value = requiredEnv(env, "CDK_COGNITO_DOMAIN_PREFIX");
  if (!resourceNamePattern.test(value)) throw new Error("CDK_COGNITO_DOMAIN_PREFIX contains invalid characters");
  return value;
}

function upstreamOidc(env: NodeJS.ProcessEnv): UpstreamOidcDeploymentConfig {
  const scopes = oidcScopes(env.CDK_UPSTREAM_OIDC_SCOPES ?? "openid profile email");
  return {
    issuerUrl: httpsUrl(env, "CDK_UPSTREAM_OIDC_ISSUER_URL"),
    authorizationUrl: httpsUrl(env, "CDK_UPSTREAM_OIDC_AUTHORIZATION_URL"),
    tokenUrl: httpsUrl(env, "CDK_UPSTREAM_OIDC_TOKEN_URL"),
    userinfoUrl: httpsUrl(env, "CDK_UPSTREAM_OIDC_USERINFO_URL"),
    clientId: requiredEnv(env, "CDK_UPSTREAM_OIDC_CLIENT_ID"),
    scopes,
    tokenAuthMethod: oidcTokenAuthMethod(env.CDK_UPSTREAM_OIDC_TOKEN_AUTH_METHOD ?? "client_secret_post"),
  };
}

function oidcScopes(value: string): string {
  const scopes = value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
  if (!scopes.includes("openid")) throw new Error("CDK_UPSTREAM_OIDC_SCOPES must include openid");
  if (!scopes.every((scope) => scopePattern.test(scope))) throw new Error("CDK_UPSTREAM_OIDC_SCOPES contains invalid scopes");
  return scopes.join(" ");
}

function oidcTokenAuthMethod(value: string): "client_secret_post" | "client_secret_basic" {
  if (value === "client_secret_post" || value === "client_secret_basic") return value;
  throw new Error("CDK_UPSTREAM_OIDC_TOKEN_AUTH_METHOD must be client_secret_post or client_secret_basic");
}

function httpsUrl(env: NodeJS.ProcessEnv, key: string): string {
  const value = requiredEnv(env, key);
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${key} must use https`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${key} contains unsupported URL parts`);
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) throw new Error(`${key} must use a public host`);
  return url.href.replace(/\/$/, "");
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

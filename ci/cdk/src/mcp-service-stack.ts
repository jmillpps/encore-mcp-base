import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import type { DeploymentConfig } from "./config.ts";
import { userDataCommands } from "./user-data.ts";

export interface McpServiceStackProps extends cdk.StackProps {
  config: DeploymentConfig;
}

export class McpServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: McpServiceStackProps) {
    super(scope, id, props);

    const publicUrl = `https://${props.config.domainName}`;
    const mcpResource = `${publicUrl}/mcp`;
    const actionsAudience = `${publicUrl}/actions`;
    const parameterKey = new kms.Key(this, "ParameterKey", {
      alias: `${props.config.appName}-${props.config.environmentName}-parameters`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const repository = new ecr.Repository(this, "Repository", {
      repositoryName: `${props.config.appName}-${props.config.environmentName}`,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
    const sourceBucket = new s3.Bucket(this, "SourceBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${props.config.appName}-${props.config.environmentName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 14,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: true,
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [`${publicUrl}/oauth/cognito/callback`],
        logoutUrls: [publicUrl],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE, cognito.OAuthScope.EMAIL],
      },
    });
    const cognitoDomainPrefix = safeDomainPrefix(props.config.cognitoDomainPrefix);
    new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool,
      cognitoDomain: { domainPrefix: cognitoDomainPrefix },
    });
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
    });
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "HTTPS and ACME ingress for the GPT MCP service",
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP ACME challenge");
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS service traffic");
    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });
    role.addToPolicy(new iam.PolicyStatement({
      actions: ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      resources: [this.parameterArn(`${parameterPath(props.config.parameterPrefix)}/*`)],
    }));
    parameterKey.grantDecrypt(role);
    repository.grantPull(role);
    const instance = new ec2.Instance(this, "Instance", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.config.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup,
      role,
      requireImdsv2: true,
      blockDevices: [{
        deviceName: "/dev/xvda",
        volume: ec2.BlockDeviceVolume.ebs(16, {
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
        }),
      }],
    });
    instance.userData.addCommands(...userDataCommands({
      config: props.config,
      region: this.region,
      repositoryUri: repository.repositoryUri,
    }));
    const elasticIp = new ec2.CfnEIP(this, "ElasticIp", { domain: "vpc" });
    new ec2.CfnEIPAssociation(this, "ElasticIpAssociation", {
      allocationId: elasticIp.attrAllocationId,
      instanceId: instance.instanceId,
    });
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: props.config.hostedZoneId,
      zoneName: props.config.hostedZoneName,
    });
    new route53.ARecord(this, "DnsRecord", {
      zone,
      recordName: relativeRecordName(props.config.domainName, props.config.hostedZoneName),
      ttl: cdk.Duration.minutes(1),
      target: route53.RecordTarget.fromIpAddresses(elasticIp.ref),
    });
    this.environmentParameters(props.config, {
      publicUrl,
      mcpResource,
      actionsAudience,
      cognitoDomainPrefix,
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPoolClient.userPoolClientId,
    });
    const buildProject = this.imageBuildProject(sourceBucket, repository);
    this.outputs({
      PublicUrl: publicUrl,
      McpResourceUrl: mcpResource,
      ActionsAudience: actionsAudience,
      ParameterPrefix: props.config.parameterPrefix,
      ParameterKeyId: parameterKey.keyId,
      RepositoryUri: repository.repositoryUri,
      SourceBucketName: sourceBucket.bucketName,
      CodeBuildProjectName: buildProject.projectName,
      InstanceId: instance.instanceId,
      ElasticIp: elasticIp.ref,
      CognitoUserPoolId: userPool.userPoolId,
      CognitoClientId: userPoolClient.userPoolClientId,
      CognitoHostedUiBaseUrl: `https://${cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com`,
    });
  }

  private environmentParameters(config: DeploymentConfig, values: {
    publicUrl: string;
    mcpResource: string;
    actionsAudience: string;
    cognitoDomainPrefix: string;
    userPoolId: string;
    userPoolClientId: string;
  }): void {
    this.stringParameter("NodeEnv", config, "NODE_ENV", "production");
    this.stringParameter("ImageTag", config, "IMAGE_TAG", "latest");
    this.stringParameter("IssuerUrl", config, "PUBLIC_ISSUER_URL", values.publicUrl);
    this.stringParameter("McpResourceUrl", config, "MCP_RESOURCE_URL", values.mcpResource);
    this.stringParameter("ActionsAudience", config, "ACTIONS_AUDIENCE", values.actionsAudience);
    this.stringParameter("StorePath", config, "OAUTH_STORE_PATH", "/var/lib/gpt-mcp-service/oauth-store.json");
    this.stringParameter("AllowedOrigins", config, "ALLOWED_ORIGINS", config.allowedOrigins);
    this.stringParameter("AccessTokenTtl", config, "ACCESS_TOKEN_TTL_SECONDS", "900");
    this.stringParameter("IdTokenTtl", config, "ID_TOKEN_TTL_SECONDS", "300");
    this.stringParameter("AuthorizationCodeTtl", config, "AUTHORIZATION_CODE_TTL_SECONDS", "300");
    this.stringParameter("RefreshTokenTtl", config, "REFRESH_TOKEN_TTL_SECONDS", "2592000");
    this.stringParameter("RateLimitWindow", config, "RATE_LIMIT_WINDOW_SECONDS", "60");
    this.stringParameter("RateLimitMaxRequests", config, "RATE_LIMIT_MAX_REQUESTS", "120");
    this.stringParameter("McpSseMaxConnections", config, "MCP_SSE_MAX_CONNECTIONS", "1024");
    this.stringParameter("CognitoEnabled", config, "COGNITO_ENABLED", "true");
    this.stringParameter("CognitoIssuerUrl", config, "COGNITO_ISSUER_URL", `https://cognito-idp.${this.region}.amazonaws.com/${values.userPoolId}`);
    this.stringParameter("CognitoAuthorizationUrl", config, "COGNITO_AUTHORIZATION_URL", `https://${values.cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/authorize`);
    this.stringParameter("CognitoTokenUrl", config, "COGNITO_TOKEN_URL", `https://${values.cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/token`);
    this.stringParameter("CognitoUserinfoUrl", config, "COGNITO_USERINFO_URL", `https://${values.cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/userInfo`);
    this.stringParameter("CognitoJwksUrl", config, "COGNITO_JWKS_URL", `https://cognito-idp.${this.region}.amazonaws.com/${values.userPoolId}/.well-known/jwks.json`);
    this.stringParameter("CognitoClientId", config, "COGNITO_CLIENT_ID", values.userPoolClientId);
    this.stringParameter("CognitoRedirectUri", config, "COGNITO_REDIRECT_URI", `${values.publicUrl}/oauth/cognito/callback`);
    this.stringParameter("CognitoScopes", config, "COGNITO_SCOPES", "openid profile email");
  }

  private imageBuildProject(sourceBucket: s3.Bucket, repository: ecr.Repository): codebuild.Project {
    const buildProject = new codebuild.Project(this, "ImageBuildProject", {
      source: codebuild.Source.s3({ bucket: sourceBucket, path: "source/source.zip" }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      environmentVariables: {
        IMAGE_REPOSITORY_URI: { value: repository.repositoryUri },
        IMAGE_TAG: { value: "latest" },
      },
      timeout: cdk.Duration.minutes(30),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              "curl -L https://encore.dev/install.sh | bash",
              "export PATH=/root/.encore/bin:$PATH",
              "encore version",
            ],
          },
          pre_build: {
            commands: [
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $IMAGE_REPOSITORY_URI",
            ],
          },
          build: {
            commands: [
              "export PATH=/root/.encore/bin:$PATH",
              "encore build docker --arch=arm64 --base=public.ecr.aws/docker/library/node:slim \"$IMAGE_REPOSITORY_URI:$IMAGE_TAG\"",
              "docker push \"$IMAGE_REPOSITORY_URI:$IMAGE_TAG\"",
            ],
          },
        },
      }),
    });
    sourceBucket.grantRead(buildProject);
    repository.grantPullPush(buildProject);
    return buildProject;
  }

  private stringParameter(id: string, config: DeploymentConfig, name: string, value: string): void {
    new ssm.StringParameter(this, id, {
      parameterName: `${config.parameterPrefix}/${name}`,
      stringValue: value,
    });
  }

  private parameterArn(path: string): string {
    return `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter/${path}`;
  }

  private outputs(values: Record<string, string>): void {
    for (const [key, value] of Object.entries(values)) {
      const output = new cdk.CfnOutput(this, `Output${key}`, { value });
      output.overrideLogicalId(key);
    }
  }
}

function parameterPath(value: string): string {
  return value.replace(/^\/+/, "");
}

function relativeRecordName(domainName: string, hostedZoneName: string): string {
  const suffix = `.${hostedZoneName}`;
  return domainName.endsWith(suffix) ? domainName.slice(0, -suffix.length) : domainName;
}

function safeDomainPrefix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

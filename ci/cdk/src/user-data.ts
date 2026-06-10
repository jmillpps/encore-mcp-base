import type { DeploymentConfig } from "./config.ts";

export interface UserDataInput {
  config: DeploymentConfig;
  region: string;
  repositoryUri: string;
}

interface RuntimePaths {
  optDir: string;
  dataDir: string;
  runDir: string;
  runScript: string;
  serviceUnit: string;
  bootstrapLog: string;
  parameterFile: string;
  envFile: string;
  privateKeyFile: string;
}

export function userDataCommands(input: UserDataInput): string[] {
  const paths = runtimePaths(input.config.serviceName);
  return [
    "set -euo pipefail",
    `exec > >(tee -a ${paths.bootstrapLog}) 2>&1`,
    "dnf update -y",
    "dnf install -y docker jq awscli tar gzip",
    "systemctl enable --now docker",
    installCaddy(),
    `mkdir -p /etc/caddy ${paths.optDir} ${paths.dataDir} /var/lib/caddy ${paths.runDir}`,
    caddyfile(input.config.domainName),
    caddyServiceUnit(),
    runScript(input, paths),
    `chmod 0500 ${paths.runScript}`,
    serviceUnit(paths),
    "systemctl daemon-reload",
    "systemctl enable --now caddy.service",
    `systemctl enable --now ${input.config.serviceName}.service`,
  ];
}

function installCaddy(): string {
  return [
    'CADDY_VERSION="2.10.2"',
    'CADDY_ARCHIVE="caddy_${CADDY_VERSION}_linux_arm64.tar.gz"',
    'curl -fsSLo "/tmp/${CADDY_ARCHIVE}" "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/${CADDY_ARCHIVE}"',
    'curl -fsSLo /tmp/caddy_checksums.txt "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_checksums.txt"',
    "cd /tmp",
    'grep " ${CADDY_ARCHIVE}$" caddy_checksums.txt > caddy.sha512',
    "sha512sum -c caddy.sha512",
    'tar -xzf "${CADDY_ARCHIVE}" caddy',
    "install -m 0755 caddy /usr/local/bin/caddy",
  ].join("\n");
}

function caddyfile(domainName: string): string {
  return `cat > /etc/caddy/Caddyfile <<'CADDY'\n${domainName} {\n  reverse_proxy 127.0.0.1:8080\n  header {\n    Strict-Transport-Security "max-age=31536000; includeSubDomains"\n    X-Content-Type-Options "nosniff"\n    Referrer-Policy "no-referrer"\n  }\n}\nCADDY`;
}

function caddyServiceUnit(): string {
  return "cat > /etc/systemd/system/caddy.service <<'UNIT'\n[Unit]\nDescription=Caddy web server\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nEnvironment=XDG_DATA_HOME=/var/lib/caddy\nEnvironment=XDG_CONFIG_HOME=/var/lib/caddy\nExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile\nExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force\nRestart=on-failure\nRestartSec=5s\nLimitNOFILE=1048576\n\n[Install]\nWantedBy=multi-user.target\nUNIT";
}

function runScript(input: UserDataInput, paths: RuntimePaths): string {
  return [
    `cat > ${paths.runScript} <<'SERVICE'`,
    "#!/bin/bash",
    "set -euo pipefail",
    `PARAMETER_PREFIX="${input.config.parameterPrefix}"`,
    `AWS_REGION="${input.region}"`,
    `IMAGE_REPOSITORY_URI="${input.repositoryUri}"`,
    `PARAMETER_FILE="${paths.parameterFile}"`,
    `ENV_FILE="${paths.envFile}"`,
    `PRIVATE_KEY_FILE="${paths.privateKeyFile}"`,
    `mkdir -p ${paths.runDir} ${paths.dataDir}`,
    'aws ssm get-parameters-by-path --path "$PARAMETER_PREFIX" --recursive --with-decryption --region "$AWS_REGION" --output json > "$PARAMETER_FILE"',
    ': > "$ENV_FILE"',
    "printf 'NODE_ENV=production\\n' >> \"$ENV_FILE\"",
    "printf 'PORT=8080\\n' >> \"$ENV_FILE\"",
    "printf 'AWS_REGION=%s\\n' \"$AWS_REGION\" >> \"$ENV_FILE\"",
    "printf 'AWS_DEFAULT_REGION=%s\\n' \"$AWS_REGION\" >> \"$ENV_FILE\"",
    'jq -r \'.Parameters[] | select(.Name | endswith("/OAUTH_PRIVATE_KEY_PEM")) | .Value\' "$PARAMETER_FILE" > "$PRIVATE_KEY_FILE"',
    'chmod 0400 "$PRIVATE_KEY_FILE"',
    "printf 'OAUTH_PRIVATE_KEY_PEM_FILE=%s\\n' \"$PRIVATE_KEY_FILE\" >> \"$ENV_FILE\"",
    "jq -r '.Parameters[] | select((.Name | endswith(\"/OAUTH_PRIVATE_KEY_PEM\")) | not) | [.Name, .Value] | @tsv' \"$PARAMETER_FILE\" | while IFS=$'\\t' read -r name value; do",
    '  key="${name##*/}"',
    "  printf '%s=%s\\n' \"$key\" \"$value\" >> \"$ENV_FILE\"",
    "done",
    'chmod 0400 "$ENV_FILE"',
    'IMAGE_TAG="$(awk -F= \'$1 == "IMAGE_TAG" { print $2 }\' "$ENV_FILE" | tail -1)"',
    'if [ -z "$IMAGE_TAG" ]; then',
    '  IMAGE_TAG="latest"',
    "fi",
    'aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$IMAGE_REPOSITORY_URI"',
    'docker pull "$IMAGE_REPOSITORY_URI:$IMAGE_TAG"',
    `docker rm -f ${input.config.serviceName} 2>/dev/null || true`,
    `docker run -d --name ${input.config.serviceName} --restart unless-stopped --env-file "$ENV_FILE" -v ${paths.dataDir}:${paths.dataDir} -v ${paths.runDir}:${paths.runDir}:ro -p 127.0.0.1:8080:8080 "$IMAGE_REPOSITORY_URI:$IMAGE_TAG"`,
    "SERVICE",
  ].join("\n");
}

function serviceUnit(paths: RuntimePaths): string {
  return `cat > ${paths.serviceUnit} <<'UNIT'\n[Unit]\nDescription=GPT MCP Service container\nAfter=docker.service network-online.target\nWants=network-online.target\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=${paths.runScript}\n\n[Install]\nWantedBy=multi-user.target\nUNIT`;
}

function runtimePaths(resourceName: string): RuntimePaths {
  const optDir = `/opt/${resourceName}`;
  const dataDir = `/var/lib/${resourceName}`;
  const runDir = `/run/${resourceName}`;
  return {
    optDir,
    dataDir,
    runDir,
    runScript: `${optDir}/run.sh`,
    serviceUnit: `/etc/systemd/system/${resourceName}.service`,
    bootstrapLog: `/var/log/${resourceName}-bootstrap.log`,
    parameterFile: `${runDir}/parameters.json`,
    envFile: `${runDir}/service.env`,
    privateKeyFile: `${runDir}/oauth-private-key.pem`,
  };
}

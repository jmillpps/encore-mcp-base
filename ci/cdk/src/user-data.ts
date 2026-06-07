import type { DeploymentConfig } from "./config.ts";

export interface UserDataInput {
  config: DeploymentConfig;
  region: string;
  repositoryUri: string;
}

export function userDataCommands(input: UserDataInput): string[] {
  return [
    "set -euo pipefail",
    "exec > >(tee -a /var/log/gpt-mcp-service-bootstrap.log) 2>&1",
    "dnf update -y",
    "dnf install -y docker jq awscli tar gzip",
    "systemctl enable --now docker",
    installCaddy(),
    "mkdir -p /etc/caddy /opt/gpt-mcp-service /var/lib/gpt-mcp-service /var/lib/caddy /run/gpt-mcp-service",
    caddyfile(input.config.domainName),
    caddyServiceUnit(),
    runScript(input),
    "chmod 0500 /opt/gpt-mcp-service/run.sh",
    serviceUnit(),
    "systemctl daemon-reload",
    "systemctl enable --now caddy.service",
    "systemctl enable --now gpt-mcp-service.service",
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

function runScript(input: UserDataInput): string {
  return [
    "cat > /opt/gpt-mcp-service/run.sh <<'SERVICE'",
    "#!/bin/bash",
    "set -euo pipefail",
    `PARAMETER_PREFIX="${input.config.parameterPrefix}"`,
    `AWS_REGION="${input.region}"`,
    `IMAGE_REPOSITORY_URI="${input.repositoryUri}"`,
    'PARAMETER_FILE="/run/gpt-mcp-service/parameters.json"',
    'ENV_FILE="/run/gpt-mcp-service/service.env"',
    'PRIVATE_KEY_FILE="/run/gpt-mcp-service/oauth-private-key.pem"',
    "mkdir -p /run/gpt-mcp-service /var/lib/gpt-mcp-service",
    'aws ssm get-parameters-by-path --path "$PARAMETER_PREFIX" --recursive --with-decryption --region "$AWS_REGION" --output json > "$PARAMETER_FILE"',
    ': > "$ENV_FILE"',
    "printf 'NODE_ENV=production\\n' >> \"$ENV_FILE\"",
    "printf 'PORT=8080\\n' >> \"$ENV_FILE\"",
    "jq -r '.Parameters[] | [.Name, .Value] | @tsv' \"$PARAMETER_FILE\" | while IFS=$'\\t' read -r name value; do",
    '  key="${name##*/}"',
    '  if [ "$key" = "OAUTH_PRIVATE_KEY_PEM" ]; then',
    '    printf \'%s\' "$value" > "$PRIVATE_KEY_FILE"',
    '    chmod 0400 "$PRIVATE_KEY_FILE"',
    "    printf 'OAUTH_PRIVATE_KEY_PEM_FILE=%s\\n' \"$PRIVATE_KEY_FILE\" >> \"$ENV_FILE\"",
    "  else",
    "    printf '%s=%s\\n' \"$key\" \"$value\" >> \"$ENV_FILE\"",
    "  fi",
    "done",
    'chmod 0400 "$ENV_FILE"',
    'IMAGE_TAG="$(awk -F= \'$1 == "IMAGE_TAG" { print $2 }\' "$ENV_FILE" | tail -1)"',
    'if [ -z "$IMAGE_TAG" ]; then',
    '  IMAGE_TAG="latest"',
    "fi",
    'aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$IMAGE_REPOSITORY_URI"',
    'docker pull "$IMAGE_REPOSITORY_URI:$IMAGE_TAG"',
    "docker rm -f gpt-mcp-service 2>/dev/null || true",
    'docker run -d --name gpt-mcp-service --restart unless-stopped --env-file "$ENV_FILE" -v /var/lib/gpt-mcp-service:/var/lib/gpt-mcp-service -v /run/gpt-mcp-service:/run/gpt-mcp-service:ro -p 127.0.0.1:8080:8080 "$IMAGE_REPOSITORY_URI:$IMAGE_TAG"',
    "SERVICE",
  ].join("\n");
}

function serviceUnit(): string {
  return "cat > /etc/systemd/system/gpt-mcp-service.service <<'UNIT'\n[Unit]\nDescription=GPT MCP Service container\nAfter=docker.service network-online.target\nWants=network-online.target\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/opt/gpt-mcp-service/run.sh\n\n[Install]\nWantedBy=multi-user.target\nUNIT";
}

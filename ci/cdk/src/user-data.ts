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
    "dnf install -y docker jq awscli dnf-plugins-core",
    "systemctl enable --now docker",
    "dnf copr enable -y @caddy/caddy",
    "dnf install -y caddy",
    "mkdir -p /opt/gpt-mcp-service /var/lib/gpt-mcp-service /run/gpt-mcp-service",
    caddyfile(input.config.domainName),
    "systemctl enable --now caddy",
    runScript(input),
    "chmod 0500 /opt/gpt-mcp-service/run.sh",
    serviceUnit(),
    "systemctl daemon-reload",
    "systemctl enable gpt-mcp-service.service",
  ];
}

function caddyfile(domainName: string): string {
  return `cat > /etc/caddy/Caddyfile <<'CADDY'\n${domainName} {\n  reverse_proxy 127.0.0.1:8080\n  header {\n    Strict-Transport-Security "max-age=31536000; includeSubDomains"\n    X-Content-Type-Options "nosniff"\n    Referrer-Policy "no-referrer"\n  }\n}\nCADDY`;
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
    'docker run -d --name gpt-mcp-service --restart unless-stopped --env-file "$ENV_FILE" -v /var/lib/gpt-mcp-service:/var/lib/gpt-mcp-service -p 127.0.0.1:8080:8080 "$IMAGE_REPOSITORY_URI:$IMAGE_TAG"',
    "SERVICE",
  ].join("\n");
}

function serviceUnit(): string {
  return "cat > /etc/systemd/system/gpt-mcp-service.service <<'UNIT'\n[Unit]\nDescription=GPT MCP Service container\nAfter=docker.service network-online.target caddy.service\nWants=network-online.target\n\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/opt/gpt-mcp-service/run.sh\n\n[Install]\nWantedBy=multi-user.target\nUNIT";
}

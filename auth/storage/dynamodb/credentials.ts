export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: number;
}

export class AwsCredentialProvider {
  private cached?: AwsCredentials;

  async credentials(): Promise<AwsCredentials> {
    const envCredentials = credentialsFromEnv();
    if (envCredentials) return envCredentials;
    if (this.cached && (!this.cached.expiration || this.cached.expiration - Date.now() > 60000)) return this.cached;
    this.cached = await credentialsFromImds();
    return this.cached;
  }
}

function credentialsFromEnv(): AwsCredentials | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN };
}

async function credentialsFromImds(): Promise<AwsCredentials> {
  const token = await imdsText("/latest/api/token", {
    method: "PUT",
    headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" },
  });
  const roleName = await imdsText("/latest/meta-data/iam/security-credentials/", {
    headers: { "X-aws-ec2-metadata-token": token },
  });
  const body = await imdsText(`/latest/meta-data/iam/security-credentials/${encodeURIComponent(roleName)}`, {
    headers: { "X-aws-ec2-metadata-token": token },
  });
  const record = JSON.parse(body) as Partial<Record<"AccessKeyId" | "SecretAccessKey" | "Token" | "Expiration", string>>;
  if (!record.AccessKeyId || !record.SecretAccessKey || !record.Token) throw new Error("IMDS credentials response is incomplete");
  return {
    accessKeyId: record.AccessKeyId,
    secretAccessKey: record.SecretAccessKey,
    sessionToken: record.Token,
    expiration: record.Expiration ? Date.parse(record.Expiration) : undefined,
  };
}

async function imdsText(path: string, init: RequestInit): Promise<string> {
  const response = await fetch(`http://169.254.169.254${path}`, {
    ...init,
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error(`IMDS request failed with ${response.status}`);
  return response.text();
}

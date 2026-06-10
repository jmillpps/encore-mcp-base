import { createHash, createHmac } from "node:crypto";
import type { AwsCredentials } from "./credentials.ts";

export interface SignedAwsRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function signDynamoDbRequest(input: {
  region: string;
  target: string;
  body: string;
  credentials: AwsCredentials;
  endpoint?: string;
  date?: Date;
}): SignedAwsRequest {
  const endpoint = input.endpoint ?? `https://dynamodb.${input.region}.amazonaws.com`;
  const url = new URL(endpoint);
  const timestamp = awsTimestamp(input.date ?? new Date());
  const date = timestamp.slice(0, 8);
  const headers = canonicalHeaders({
    "content-type": "application/x-amz-json-1.0",
    host: url.host,
    "x-amz-date": timestamp,
    "x-amz-target": input.target,
    ...(input.credentials.sessionToken ? { "x-amz-security-token": input.credentials.sessionToken } : {}),
  });
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    "POST",
    url.pathname || "/",
    "",
    Object.keys(headers).sort().map((key) => `${key}:${headers[key]}`).join("\n"),
    "",
    signedHeaders,
    sha256Hex(input.body),
  ].join("\n");
  const scope = `${date}/${input.region}/dynamodb/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.credentials.secretAccessKey}`, date), input.region), "dynamodb"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const { host, ...requestHeaders } = headers;
  void host;
  return {
    url: url.href,
    body: input.body,
    headers: {
      ...requestHeaders,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function awsTimestamp(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value.trim().replace(/\s+/g, " ")]));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

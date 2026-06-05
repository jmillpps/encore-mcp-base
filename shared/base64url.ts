export function encodeBase64Url(input: Buffer | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
}

export function decodeBase64Url(input: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw new Error("invalid_base64url");
  return Buffer.from(input, "base64url");
}

export function encodeJsonBase64Url(value: unknown): string {
  return encodeBase64Url(JSON.stringify(value));
}

export function decodeJsonBase64Url(input: string): unknown {
  return JSON.parse(decodeBase64Url(input).toString("utf8"));
}

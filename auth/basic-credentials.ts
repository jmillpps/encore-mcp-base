import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

export interface BasicCredentials {
  clientId: string;
  clientSecret: string;
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

export function decodeBasicCredentials(credentials: string): BasicCredentials | undefined {
  try {
    if (!validBase64(credentials)) return undefined;
    const decoded = utf8Decoder.decode(Buffer.from(padded(credentials), "base64"));
    const separator = decoded.indexOf(":");
    if (separator < 1) return undefined;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return undefined;
  }
}

function validBase64(value: string): boolean {
  if (!base64Pattern.test(value) || value.length % 4 === 1) return false;
  const firstPadding = value.indexOf("=");
  return firstPadding === -1 || (value.length % 4 === 0 && /^[A-Za-z0-9+/]+={1,2}$/.test(value));
}

function padded(value: string): string {
  return value.padEnd(Math.ceil(value.length / 4) * 4, "=");
}

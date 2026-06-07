import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { invalidMetadataClient } from "./client-metadata-error.ts";

export interface NetworkAddress {
  address: string;
  family: 4 | 6;
}

export function parseClientIdUrl(value: string, production: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidMetadataClient();
  }
  if (url.username || url.password || url.search || url.hash) throw invalidMetadataClient();
  if (url.pathname === "/") throw invalidMetadataClient();
  if (value.includes("*")) throw invalidMetadataClient();
  if (production) {
    if (url.protocol !== "https:") throw invalidMetadataClient();
    return url;
  }
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && isLoopbackHostname(url.hostname)) return url;
  throw invalidMetadataClient();
}

export async function resolveMetadataNetworkAddress(url: URL, production: boolean): Promise<NetworkAddress | undefined> {
  if (!production) return undefined;
  const hostname = networkHostname(url.hostname);
  if (isLoopbackHostname(hostname)) throw invalidMetadataClient();
  const literal = isIP(hostname);
  const addresses = literal ? [{ address: hostname, family: literal as 4 | 6 }] : await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw invalidMetadataClient();
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw invalidMetadataClient();
  const first = addresses[0];
  if (!first || (first.family !== 4 && first.family !== 6)) throw invalidMetadataClient();
  return { address: first.address, family: first.family };
}

export function networkHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return hostname.slice(1, -1);
  return hostname;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = networkHostname(hostname).toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function isPrivateAddress(address: string): boolean {
  return isPrivateIpv4(address) || isPrivateIpv6(address);
}

function isPrivateIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const parts = address.split(".").map(Number);
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  if (first >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:") && isPrivateIpv4(normalized.slice("::ffff:".length))) return true;
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized === "::";
}

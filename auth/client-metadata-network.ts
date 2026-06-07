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
  if (addresses.length === 0 || addresses.some(({ address }) => isNonPublicAddress(address))) throw invalidMetadataClient();
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

function isNonPublicAddress(address: string): boolean {
  return isNonPublicIpv4(address) || isNonPublicIpv6(address);
}

function isNonPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const parts = address.split(".").map(Number);
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  const third = parts[2] ?? 0;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 0 && (third === 0 || third === 2)) return true;
  if (first === 192 && second === 88 && third === 99) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  if (first === 198 && (second === 18 || second === 19)) return true;
  if (first === 198 && second === 51 && third === 100) return true;
  if (first === 203 && second === 0 && third === 113) return true;
  if (first >= 224) return true;
  return false;
}

function isNonPublicIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  const mapped = mappedIpv4Address(normalized);
  if (mapped && isNonPublicIpv4(mapped)) return true;
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("64:ff9b:1:") ||
    normalized.startsWith("100:") ||
    normalized.startsWith("2001:2:") ||
    normalized.startsWith("2001:10:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2001:0db8:") ||
    normalized.startsWith("2002:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
}

function mappedIpv4Address(value: string): string | undefined {
  if (!value.startsWith("::ffff:")) return undefined;
  const tail = value.slice("::ffff:".length);
  if (isIP(tail) === 4) return tail;
  const groups = tail.split(":");
  if (groups.length !== 2) return undefined;
  const first = ipv6MappedGroup(groups[0]);
  const second = ipv6MappedGroup(groups[1]);
  if (first === undefined || second === undefined) return undefined;
  return `${first >> 8}.${first & 255}.${second >> 8}.${second & 255}`;
}

function ipv6MappedGroup(value: string | undefined): number | undefined {
  if (value === undefined || !/^[0-9a-f]{1,4}$/.test(value)) return undefined;
  return Number.parseInt(value, 16);
}

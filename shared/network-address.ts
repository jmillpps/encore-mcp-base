import { isIP } from "node:net";

export function networkHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return hostname.slice(1, -1);
  return hostname;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = networkHostname(hostname).toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

export function isNonPublicHostname(hostname: string): boolean {
  const normalized = networkHostname(hostname).toLowerCase();
  return normalized === "localhost" || isNonPublicIpAddress(normalized);
}

export function isNonPublicIpAddress(address: string): boolean {
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

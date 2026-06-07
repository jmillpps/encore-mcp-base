import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isLoopbackHostname, isNonPublicIpAddress, networkHostname } from "../shared/network-address.ts";
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
  if (addresses.length === 0 || addresses.some(({ address }) => isNonPublicIpAddress(address))) throw invalidMetadataClient();
  const first = addresses[0];
  if (!first || (first.family !== 4 && first.family !== 6)) throw invalidMetadataClient();
  return { address: first.address, family: first.family };
}

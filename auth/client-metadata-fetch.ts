import { Buffer } from "node:buffer";
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { TextDecoder } from "node:util";
import { mediaType } from "../shared/media-type.ts";
import { networkHostname } from "../shared/network-address.ts";
import { invalidMetadataClient } from "./client-metadata-error.ts";
import type { NetworkAddress } from "./client-metadata-network.ts";

const maximumMetadataBytes = 32768;
const metadataFetchTimeoutMs = 3000;
const defaultCacheSeconds = 300;
const maximumCacheSeconds = 3600;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export async function fetchMetadataDocument(url: URL, networkAddress: NetworkAddress | undefined): Promise<{ body: unknown; cacheSeconds: number }> {
  let response: IncomingMessage;
  try {
    response = await openMetadataRequest(url, networkAddress);
  } catch {
    throw invalidMetadataClient();
  }
  if (!validStatus(response.statusCode)) return rejectResponse(response);
  const contentType = singletonHeader(response, "content-type");
  if (contentType !== null && mediaType(contentType) !== "application/json") return rejectResponse(response);
  const contentLength = singletonHeader(response, "content-length");
  if (contentLength !== null && !validContentLength(contentLength)) return rejectResponse(response);
  const bodyText = await readMetadataBody(response);
  if (Buffer.byteLength(bodyText, "utf8") > maximumMetadataBytes) throw invalidMetadataClient();
  try {
    return { body: JSON.parse(bodyText), cacheSeconds: cacheSeconds(combinedHeader(response.headers, "cache-control")) };
  } catch {
    throw invalidMetadataClient();
  }
}

async function openMetadataRequest(url: URL, networkAddress: NetworkAddress | undefined): Promise<IncomingMessage> {
  return new Promise((resolveResponse, reject) => {
    const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "GET",
      headers: { accept: "application/json" },
      timeout: metadataFetchTimeoutMs,
      ...(networkAddress ? { lookup: pinnedLookup(networkAddress) } : {}),
      ...(url.protocol === "https:" ? { servername: networkHostname(url.hostname) } : {}),
    };
    const req = requestFn(options, (response) => resolveResponse(response));
    req.setTimeout(metadataFetchTimeoutMs, () => req.destroy(invalidMetadataClient()));
    req.on("error", reject);
    req.end();
  });
}

function pinnedLookup(networkAddress: NetworkAddress): RequestOptions["lookup"] {
  return (_hostname, options, callback) => {
    const complete = callback as (error: NodeJS.ErrnoException | null, address: string | NetworkAddress[], family?: 4 | 6) => void;
    if (typeof options === "object" && options !== null && "all" in options && options.all === true) {
      complete(null, [networkAddress]);
      return;
    }
    complete(null, networkAddress.address, networkAddress.family);
  };
}

async function readMetadataBody(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumMetadataBytes) {
      response.destroy(invalidMetadataClient());
      throw invalidMetadataClient();
    }
    chunks.push(buffer);
  }
  try {
    return utf8Decoder.decode(Buffer.concat(chunks));
  } catch {
    throw invalidMetadataClient();
  }
}

function validStatus(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
}

function rejectResponse(response: IncomingMessage): never {
  response.resume();
  throw invalidMetadataClient();
}

function singletonHeader(response: IncomingMessage, key: string): string | null {
  const distinct = response.headersDistinct?.[key];
  if (distinct !== undefined) {
    if (distinct.length !== 1) return rejectResponse(response);
    return distinct[0] ?? null;
  }
  const value = response.headers[key];
  if (Array.isArray(value)) {
    if (value.length !== 1) return rejectResponse(response);
    return value[0] ?? null;
  }
  return value ?? null;
}

function combinedHeader(headers: IncomingHttpHeaders, key: string): string | null {
  const value = headers[key];
  if (Array.isArray(value)) return value.join(",");
  return value ?? null;
}

function validContentLength(value: string): boolean {
  return /^[0-9]+$/.test(value) && Number(value) <= maximumMetadataBytes;
}

function cacheSeconds(value: string | null): number {
  if (!value) return defaultCacheSeconds;
  const directives = value.split(",").map((directive) => directive.trim().toLowerCase());
  if (directives.includes("no-store")) return 0;
  const maxAge = directives.find((directive) => directive.startsWith("max-age="));
  if (!maxAge) return defaultCacheSeconds;
  const parsed = Number(maxAge.slice("max-age=".length));
  if (!Number.isSafeInteger(parsed) || parsed < 0) return defaultCacheSeconds;
  return Math.min(parsed, maximumCacheSeconds);
}

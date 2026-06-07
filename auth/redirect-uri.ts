export function parseRedirectUri(value: string, key: string): URL {
  if (value !== value.trim()) throw new Error(`${key} cannot include surrounding whitespace`);
  if (value.includes("*")) throw new Error(`${key} cannot contain wildcards`);
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${key} must use http or https`);
  if (url.username || url.password) throw new Error(`${key} cannot include credentials`);
  if (url.hash) throw new Error(`${key} cannot include fragments`);
  return url;
}

export function productionRedirectUriAllowed(url: URL): boolean {
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLoopbackRedirectHostname(url.hostname);
}

function isLoopbackRedirectHostname(hostname: string): boolean {
  const normalized = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1).toLowerCase() : hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function mediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function acceptsMediaType(value: string, expected: string): boolean {
  const normalized = expected.toLowerCase();
  return value.split(",").some((range) => mediaType(range) === normalized && mediaRangeAccepted(range));
}

export function contentTypeUsesUtf8(value: string): boolean {
  const charset = mediaTypeParameter(value, "charset");
  return charset === undefined || charset === "utf-8";
}

function mediaTypeParameter(value: string, name: string): string | undefined {
  const normalized = name.toLowerCase();
  const parts = value.split(";").slice(1);
  let matched: string | undefined;
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    if (key !== normalized) continue;
    if (matched !== undefined) return "";
    matched = unquote(part.slice(separator + 1).trim()).toLowerCase();
  }
  return matched;
}

function mediaRangeAccepted(value: string): boolean {
  const quality = mediaTypeParameter(value, "q");
  if (quality === undefined) return true;
  if (!/^(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)$/.test(quality)) return false;
  return Number(quality) > 0;
}

function unquote(value: string): string {
  if (value.startsWith("\"") && value.endsWith("\"")) return value.slice(1, -1);
  return value;
}

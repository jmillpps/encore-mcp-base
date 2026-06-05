export function mediaType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function acceptsMediaType(value: string, expected: string): boolean {
  const normalized = expected.toLowerCase();
  return value.split(",").some((range) => mediaType(range) === normalized);
}

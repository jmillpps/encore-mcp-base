export function emptyInputSchema(): Record<string, unknown> {
  return objectSchema({});
}

export function objectSchema(properties: Record<string, Record<string, unknown>>, required = Object.keys(properties)): Record<string, unknown> {
  return { type: "object", required, properties, additionalProperties: false };
}

export function stringSchema(): Record<string, unknown> {
  return { type: "string" };
}

export function booleanSchema(): Record<string, unknown> {
  return { type: "boolean" };
}

export function stringArraySchema(): Record<string, unknown> {
  return { type: "array", items: stringSchema() };
}

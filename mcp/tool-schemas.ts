export function emptyInputSchema(): Record<string, unknown> {
  return objectSchema("No input arguments.", {});
}

export function objectSchema(description: string, properties: Record<string, Record<string, unknown>>, required = Object.keys(properties)): Record<string, unknown> {
  return { type: "object", description, required, properties, additionalProperties: false };
}

export function stringSchema(description: string): Record<string, unknown> {
  return { type: "string", description };
}

export function booleanSchema(description: string): Record<string, unknown> {
  return { type: "boolean", description };
}

export function stringArraySchema(description: string, itemDescription: string): Record<string, unknown> {
  return { type: "array", description, items: stringSchema(itemDescription) };
}

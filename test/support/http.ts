import assert from "node:assert/strict";

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value = await response.json();
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

export async function expectOAuthError(response: Response, status: number, code: string): Promise<Record<string, unknown>> {
  assert.equal(response.status, status);
  const body = await readJson(response);
  assert.equal(body.error, code);
  assert.equal(typeof body.error_description, "string");
  return body;
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") assert.fail(`${name} must be a string`);
  return value;
}

export function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) assert.fail(`${name} must be an object`);
  return value as Record<string, unknown>;
}

export function assertExposesHeader(response: Response, header: string): void {
  const exposed = (response.headers.get("access-control-expose-headers") ?? "").split(",").map((value) => value.trim().toLowerCase());
  assert.ok(exposed.includes(header.toLowerCase()));
}

import assert from "node:assert/strict";

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value = await response.json();
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

export async function expectOAuthError(response: Response, status: number, code: string): Promise<void> {
  assert.equal(response.status, status);
  const body = await readJson(response);
  assert.equal(body.error, code);
  assert.equal(typeof body.error_description, "string");
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") assert.fail(`${name} must be a string`);
  return value;
}

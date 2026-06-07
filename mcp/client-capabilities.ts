import { badRequest } from "../shared/errors.ts";
import { asRecord } from "../shared/json.ts";

export function validateClientCapabilities(capabilities: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(capabilities)) {
    requireObject(value, `capabilities.${key}`);
  }
  validateExperimental(capabilities.experimental);
  validateRoots(capabilities.roots);
  validateSampling(capabilities.sampling);
  validateElicitation(capabilities.elicitation);
  validateTasks(capabilities.tasks);
}

function validateExperimental(value: unknown): void {
  if (value === undefined) return;
  const record = asRecord(value, "capabilities.experimental");
  for (const [key, capability] of Object.entries(record)) {
    requireObject(capability, `capabilities.experimental.${key}`);
  }
}

function validateRoots(value: unknown): void {
  if (value === undefined) return;
  const record = asRecord(value, "capabilities.roots");
  assertKeys(record, ["listChanged"], "capabilities.roots");
  optionalBoolean(record, "listChanged", "capabilities.roots.listChanged");
}

function validateSampling(value: unknown): void {
  if (value === undefined) return;
  const record = asRecord(value, "capabilities.sampling");
  assertKeys(record, ["context", "tools"], "capabilities.sampling");
  optionalObject(record, "context", "capabilities.sampling.context");
  optionalObject(record, "tools", "capabilities.sampling.tools");
}

function validateElicitation(value: unknown): void {
  if (value === undefined) return;
  const record = asRecord(value, "capabilities.elicitation");
  assertKeys(record, ["form", "url"], "capabilities.elicitation");
  optionalObject(record, "form", "capabilities.elicitation.form");
  optionalObject(record, "url", "capabilities.elicitation.url");
}

function validateTasks(value: unknown): void {
  if (value === undefined) return;
  const record = asRecord(value, "capabilities.tasks");
  assertKeys(record, ["list", "cancel", "requests"], "capabilities.tasks");
  optionalObject(record, "list", "capabilities.tasks.list");
  optionalObject(record, "cancel", "capabilities.tasks.cancel");
  if (record.requests !== undefined) validateTaskRequests(record.requests);
}

function validateTaskRequests(value: unknown): void {
  const record = asRecord(value, "capabilities.tasks.requests");
  assertKeys(record, ["sampling", "elicitation"], "capabilities.tasks.requests");
  if (record.sampling !== undefined) validateSamplingTaskRequests(record.sampling);
  if (record.elicitation !== undefined) validateElicitationTaskRequests(record.elicitation);
}

function validateSamplingTaskRequests(value: unknown): void {
  const record = asRecord(value, "capabilities.tasks.requests.sampling");
  assertKeys(record, ["createMessage"], "capabilities.tasks.requests.sampling");
  optionalObject(record, "createMessage", "capabilities.tasks.requests.sampling.createMessage");
}

function validateElicitationTaskRequests(value: unknown): void {
  const record = asRecord(value, "capabilities.tasks.requests.elicitation");
  assertKeys(record, ["create"], "capabilities.tasks.requests.elicitation");
  optionalObject(record, "create", "capabilities.tasks.requests.elicitation.create");
}

function assertKeys(record: Record<string, unknown>, allowed: readonly string[], name: string): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw badRequest(`${name} contains unsupported fields`);
}

function optionalObject(record: Record<string, unknown>, key: string, name: string): void {
  if (record[key] !== undefined) requireObject(record[key], name);
}

function optionalBoolean(record: Record<string, unknown>, key: string, name: string): void {
  const value = record[key];
  if (value !== undefined && typeof value !== "boolean") throw badRequest(`${name} must be a boolean`);
}

function requireObject(value: unknown, name: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw badRequest(`${name} must be an object`);
}

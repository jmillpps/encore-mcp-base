import { awsJson } from "./aws.ts";

export type StackOutputs = Record<string, string>;

export async function stackOutputs(stackName: string): Promise<StackOutputs> {
  const response = await awsJson(["cloudformation", "describe-stacks", "--stack-name", stackName]);
  const stack = asArray(asRecord(response).Stacks)[0];
  const outputs = asArray(asRecord(stack).Outputs);
  return Object.fromEntries(outputs.map((entry) => {
    const record = asRecord(entry);
    return [stringValue(record.OutputKey), stringValue(record.OutputValue)];
  }));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value;
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("expected string");
  return value;
}

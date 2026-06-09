import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnFile } from "./process.ts";

export async function awsJson(args: string[]): Promise<unknown> {
  const output = await spawnFile("aws", [...args, "--output", "json"]);
  return JSON.parse(output);
}

export async function awsText(args: string[]): Promise<string> {
  return spawnFile("aws", [...args, "--output", "text"]);
}

export async function putSecureParameter(input: {
  name: string;
  keyId: string;
  value: string;
}): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "mcp-cdk-ssm-"));
  const valueFile = join(directory, "value");
  try {
    await writeFile(valueFile, input.value, { mode: 0o600 });
    await awsText([
      "ssm",
      "put-parameter",
      "--name",
      input.name,
      "--type",
      "SecureString",
      "--key-id",
      input.keyId,
      "--value",
      `file://${valueFile}`,
      "--overwrite",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

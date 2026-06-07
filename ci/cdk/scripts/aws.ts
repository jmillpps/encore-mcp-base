import { spawnFile } from "./process.ts";

export async function awsJson(args: string[]): Promise<unknown> {
  const output = await spawnFile("aws", [...args, "--output", "json"]);
  return JSON.parse(output);
}

export async function awsText(args: string[]): Promise<string> {
  return spawnFile("aws", [...args, "--output", "text"]);
}

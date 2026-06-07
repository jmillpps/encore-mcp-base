#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { awsJson, awsText } from "./aws.ts";
import { createSourceArchive } from "../../../tools/source-archive.ts";
import { stackOutputs } from "./stack-outputs.ts";

interface Options {
  stackName: string;
  imageTag: string;
}

const options = parseArgs(process.argv.slice(2));
const outputs = await stackOutputs(options.stackName);
const bucket = requiredOutput(outputs, "SourceBucketName");
const projectName = requiredOutput(outputs, "CodeBuildProjectName");
const repositoryUri = requiredOutput(outputs, "RepositoryUri");
const projectRoot = resolve(import.meta.dirname, "../../..");
const tempDir = await mkdtemp(join(tmpdir(), "gpt-mcp-service-source-"));
const sourceZip = join(tempDir, "source.zip");

try {
  await createSourceArchive(projectRoot, sourceZip);
  await awsText(["s3", "cp", sourceZip, `s3://${bucket}/source/source.zip`]);
  const build = await awsJson([
    "codebuild",
    "start-build",
    "--project-name",
    projectName,
    "--environment-variables-override",
    `name=IMAGE_TAG,value=${options.imageTag},type=PLAINTEXT`,
  ]);
  const buildId = (build as { build?: { id?: string } }).build?.id;
  if (!buildId) throw new Error("CodeBuild did not return a build id");
  console.log(JSON.stringify({ buildId, repositoryUri, imageTag: options.imageTag }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function parseArgs(args: string[]): Options {
  const parsed: Options = { stackName: "GptMcpServiceProd", imageTag: "latest" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--stack-name") parsed.stackName = requiredArg(args, (index += 1), arg);
    else if (arg === "--image-tag") parsed.imageTag = requiredArg(args, (index += 1), arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

function requiredArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function requiredOutput(outputs: Record<string, string>, name: string): string {
  const value = outputs[name];
  if (!value) throw new Error(`missing stack output ${name}`);
  return value;
}

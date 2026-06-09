#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { deploymentStackName, stackName } from "../src/config.ts";
import { spawnPassthrough } from "./process.ts";
import { syncGeneratedRuntimeParameters } from "./generated-runtime-parameters.ts";

const args = process.argv.slice(2);
const deployedStackName = parseDeployStackName(args, process.env);
await spawnPassthrough(cdkBinary(), ["deploy", ...args]);
const result = await syncGeneratedRuntimeParameters(deployedStackName);
console.log(JSON.stringify({ generatedRuntimeParameters: result }, null, 2));

function cdkBinary(): string {
  return fileURLToPath(new URL("../node_modules/.bin/cdk", import.meta.url));
}

function parseDeployStackName(args: string[], env: NodeJS.ProcessEnv): string {
  const firstArg = args[0];
  if (firstArg && !firstArg.startsWith("-")) return stackName(firstArg);
  return deploymentStackName(env);
}

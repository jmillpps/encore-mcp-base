#!/usr/bin/env node
import { deploymentStackName, stackName } from "../src/config.ts";
import { syncGeneratedRuntimeParameters } from "./generated-runtime-parameters.ts";

const result = await syncGeneratedRuntimeParameters(parseStackName(process.argv.slice(2), process.env));
console.log(JSON.stringify(result, null, 2));

function parseStackName(args: string[], env: NodeJS.ProcessEnv): string {
  let parsed = env.CDK_STACK_NAME ?? "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--stack-name") parsed = args[(index += 1)] ?? "";
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (parsed) return stackName(parsed);
  return deploymentStackName(env);
}

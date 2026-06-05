import { asRecord, optionalString } from "../shared/json.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";

export function initializeResult(params: unknown): Record<string, unknown> {
  const record = asRecord(params, "params");
  const requested = optionalString(record, "protocolVersion");
  return {
    protocolVersion: requested === supportedProtocolVersion ? requested : supportedProtocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: "gpt-mcp-service",
      title: "GPT MCP Service",
      version: "0.1.0",
    },
  };
}

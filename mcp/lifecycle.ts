import { ServiceError } from "../shared/errors.ts";
import { asRecord, requiredString } from "../shared/json.ts";
import type { ServiceConfig } from "../shared/config.ts";
import { serverImplementationInfo } from "../shared/service-info.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";
import { serverInstructions } from "./server-instructions.ts";
import { validateClientCapabilities } from "./client-capabilities.ts";
import { implementationName, validateImplementation } from "./implementation.ts";
import { McpProtocolError } from "./protocol-error.ts";
import { requiredMethodParams } from "./request-params.ts";

export function initializeResult(config: ServiceConfig, params: unknown): Record<string, unknown> {
  const record = initializeParams(params);
  const requested = requiredString(record, "protocolVersion");
  return {
    protocolVersion: requested === supportedProtocolVersion ? requested : supportedProtocolVersion,
    capabilities: { tools: { listChanged: false }, resources: {} },
    serverInfo: serverImplementationInfo(config.issuer),
    instructions: serverInstructions,
  };
}

export function initializeClientId(params: unknown): string {
  const clientInfo = validateImplementation(initializeParams(params).clientInfo, "clientInfo");
  return implementationName(clientInfo);
}

function initializeParams(params: unknown): Record<string, unknown> {
  try {
    const record = requiredMethodParams(params, "initialize", ["_meta", "protocolVersion", "capabilities", "clientInfo"]);
    requiredString(record, "protocolVersion");
    validateClientCapabilities(asRecord(record.capabilities, "capabilities"));
    validateImplementation(record.clientInfo, "clientInfo");
    return record;
  } catch (error) {
    if (error instanceof McpProtocolError) throw error;
    if (error instanceof ServiceError) throw new McpProtocolError(-32602, error.message);
    throw error;
  }
}

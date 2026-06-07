import { asRecord, requiredString } from "../shared/json.ts";
import { serviceName, serviceTitle, serviceVersion } from "../shared/service-info.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";
import { serverInstructions } from "./server-instructions.ts";
import { validateClientCapabilities } from "./client-capabilities.ts";
import { implementationName, validateImplementation } from "./implementation.ts";

export function initializeResult(params: unknown): Record<string, unknown> {
  const record = initializeParams(params);
  const requested = requiredString(record, "protocolVersion");
  return {
    protocolVersion: requested === supportedProtocolVersion ? requested : supportedProtocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: serviceName,
      title: serviceTitle,
      version: serviceVersion,
    },
    instructions: serverInstructions,
  };
}

export function initializeClientId(params: unknown): string {
  const clientInfo = validateImplementation(initializeParams(params).clientInfo, "clientInfo");
  return implementationName(clientInfo);
}

function initializeParams(params: unknown): Record<string, unknown> {
  const record = asRecord(params, "params");
  requiredString(record, "protocolVersion");
  validateClientCapabilities(asRecord(record.capabilities, "capabilities"));
  validateImplementation(record.clientInfo, "clientInfo");
  return record;
}

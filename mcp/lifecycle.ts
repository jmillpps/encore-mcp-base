import { asRecord, optionalString } from "../shared/json.ts";
import { serviceName, serviceTitle, serviceVersion } from "../shared/service-info.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";

export function initializeResult(params: unknown): Record<string, unknown> {
  const record = asRecord(params, "params");
  const requested = optionalString(record, "protocolVersion");
  return {
    protocolVersion: requested === supportedProtocolVersion ? requested : supportedProtocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: serviceName,
      title: serviceTitle,
      version: serviceVersion,
    },
  };
}

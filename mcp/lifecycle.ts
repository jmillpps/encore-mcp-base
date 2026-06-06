import { asRecord, optionalString } from "../shared/json.ts";
import { badRequest } from "../shared/errors.ts";
import { serviceName, serviceTitle, serviceVersion } from "../shared/service-info.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";

const mcpClientIdPattern = /^[A-Za-z0-9._:/ -]{1,128}$/;
const unknownMcpClientId = "unknown-mcp-client";

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

export function initializeClientId(params: unknown): string {
  const clientInfo = asRecord(params, "params").clientInfo;
  if (clientInfo === undefined) return unknownMcpClientId;
  const name = optionalString(asRecord(clientInfo, "clientInfo"), "name");
  if (name === undefined) return unknownMcpClientId;
  if (!mcpClientIdPattern.test(name)) throw badRequest("clientInfo.name is invalid");
  return name;
}

import { asRecord, requiredString } from "../shared/json.ts";
import { badRequest } from "../shared/errors.ts";
import { serviceName, serviceTitle, serviceVersion } from "../shared/service-info.ts";
import { supportedProtocolVersion } from "./protocol-version.ts";

const implementationNamePattern = /^[A-Za-z0-9._:/ -]{1,128}$/;
const implementationVersionPattern = /^[\x20-\x7E]{1,128}$/;

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
  };
}

export function initializeClientId(params: unknown): string {
  const clientInfo = clientImplementation(initializeParams(params));
  return implementationName(clientInfo);
}

function initializeParams(params: unknown): Record<string, unknown> {
  const record = asRecord(params, "params");
  requiredString(record, "protocolVersion");
  asRecord(record.capabilities, "capabilities");
  clientImplementation(record);
  return record;
}

function clientImplementation(record: Record<string, unknown>): Record<string, unknown> {
  const clientInfo = asRecord(record.clientInfo, "clientInfo");
  implementationName(clientInfo);
  const version = requiredString(clientInfo, "version");
  if (!implementationVersionPattern.test(version)) throw badRequest("clientInfo.version is invalid");
  return clientInfo;
}

function implementationName(record: Record<string, unknown>): string {
  const name = requiredString(record, "name");
  if (!implementationNamePattern.test(name)) throw badRequest("clientInfo.name is invalid");
  return name;
}

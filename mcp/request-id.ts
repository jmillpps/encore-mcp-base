import { sha256Base64Url } from "../shared/crypto.ts";
import type { JsonRpcId } from "./json-rpc.ts";
import { McpProtocolError } from "./protocol-error.ts";

export const mcpRequestIdLimit = 4096;

export function mcpRequestIdHash(id: JsonRpcId): string {
  return sha256Base64Url(`${typeof id}:${String(id)}`);
}

export function duplicateRequestIdError(): McpProtocolError {
  return new McpProtocolError(-32600, "duplicate json-rpc request id");
}

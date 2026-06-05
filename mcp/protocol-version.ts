import { ServiceError } from "../shared/errors.ts";

export const supportedProtocolVersion = "2025-11-25";

export function negotiateProtocolVersion(version: string | undefined): string {
  if (!version || version === supportedProtocolVersion) return supportedProtocolVersion;
  throw new ServiceError("bad_request", "unsupported protocol version", 400);
}

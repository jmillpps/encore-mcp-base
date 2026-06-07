import { ServiceError } from "../shared/errors.ts";

export function invalidMetadataClient(): ServiceError {
  return new ServiceError("invalid_client", "invalid client", 401);
}

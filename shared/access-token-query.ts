import { ServiceError } from "./errors.ts";

export function rejectAccessTokenQuery(url: string | undefined): void {
  if (new URL(url ?? "/", "http://localhost").searchParams.has("access_token")) {
    throw new ServiceError("bad_request", "access tokens must use the authorization header", 400);
  }
}

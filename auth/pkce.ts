import { ServiceError } from "../shared/errors.ts";

const pkcePattern = /^[A-Za-z0-9._~-]{43,128}$/;

export function pkceInput(policy: string, challenge: string | undefined, method: string | undefined): { codeChallenge?: string; codeChallengeMethod?: "S256" } {
  if (!challenge && policy === "required") throw new ServiceError("bad_request", "code_challenge is required", 400);
  if (!challenge) return {};
  if (!pkcePattern.test(challenge)) throw new ServiceError("bad_request", "invalid code_challenge", 400);
  if (method !== "S256") throw new ServiceError("bad_request", "code_challenge_method must be S256", 400);
  return { codeChallenge: challenge, codeChallengeMethod: "S256" };
}

export function pkceVerifier(value: string | undefined): string {
  if (!value || !pkcePattern.test(value)) throw new ServiceError("invalid_grant", "invalid grant", 400);
  return value;
}

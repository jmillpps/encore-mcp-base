export interface StaticUser {
  sub: string;
  given_name: string;
  family_name: string;
  name: string;
  preferred_username: string;
  email: string;
  email_verified: boolean;
}

export interface UserProfileClaims {
  sub: string;
  given_name: string;
  family_name: string;
  name: string;
  preferred_username: string;
  email: string;
  email_verified: boolean;
}

const localDefaults: StaticUser = {
  sub: "user_example",
  given_name: "Example",
  family_name: "User",
  name: "Example User",
  preferred_username: "example.user",
  email: "user@example.test",
  email_verified: true,
};

export function readStaticUser(env: NodeJS.ProcessEnv = process.env): StaticUser {
  const production = env.NODE_ENV === "production";
  const givenName = profileValue(env, "STATIC_USER_GIVEN_NAME", localDefaults.given_name, production);
  const familyName = profileValue(env, "STATIC_USER_FAMILY_NAME", localDefaults.family_name, production);
  return {
    sub: profileValue(env, "STATIC_USER_SUB", localDefaults.sub, production),
    given_name: givenName,
    family_name: familyName,
    name: profileValue(env, "STATIC_USER_NAME", `${givenName} ${familyName}`.trim(), production),
    preferred_username: profileValue(env, "STATIC_USER_PREFERRED_USERNAME", localDefaults.preferred_username, production),
    email: emailValue(env, production),
    email_verified: booleanValue(env, "STATIC_USER_EMAIL_VERIFIED", localDefaults.email_verified, production),
  };
}

export function userProfileFromClaims(claims: UserProfileClaims): StaticUser {
  return validateUserProfile(claims, true);
}

export function userProfileFromJson(value: string): StaticUser {
  try {
    return validateUserProfile(JSON.parse(value), true);
  } catch {
    throw new Error("user profile is malformed");
  }
}

export function userProfileJson(user: StaticUser): string {
  return JSON.stringify(validateUserProfile(user, true));
}

export function userProfileFromUpstream(value: unknown): StaticUser {
  return validateUserProfile(value, false);
}

function validateUserProfile(value: unknown, strict: boolean): StaticUser {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("user profile is malformed");
  const record = value as Record<string, unknown>;
  const givenName = profileClaim(record.given_name, "given_name", strict) ?? "Authenticated";
  const familyName = profileClaim(record.family_name, "family_name", strict) ?? "User";
  const email = emailClaim(record.email, strict);
  return {
    sub: requiredProfileClaim(record.sub, "sub"),
    given_name: givenName,
    family_name: familyName,
    name: profileClaim(record.name, "name", strict) ?? `${givenName} ${familyName}`.trim(),
    preferred_username: profileClaim(record.preferred_username, "preferred_username", strict) ?? email,
    email,
    email_verified: booleanClaim(record.email_verified, strict),
  };
}

function requiredProfileClaim(value: unknown, name: string): string {
  const parsed = profileClaim(value, name, true);
  if (!parsed) throw new Error(`${name} is required`);
  return parsed;
}

function profileClaim(value: unknown, name: string, required: boolean): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${name} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw new Error(`${name} is required`);
    return undefined;
  }
  if (trimmed.length > 256) throw new Error(`${name} must be at most 256 characters`);
  if (/[\r\n]/.test(trimmed)) throw new Error(`${name} cannot contain line breaks`);
  return trimmed;
}

function emailClaim(value: unknown, required: boolean): string {
  const email = profileClaim(value, "email", required);
  if (!email) throw new Error("email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email must be an email address");
  return email;
}

function booleanClaim(value: unknown, required: boolean): boolean {
  if (value === undefined || value === null) {
    if (required) throw new Error("email_verified is required");
    return true;
  }
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("email_verified must be true or false");
}

function profileValue(env: NodeJS.ProcessEnv, key: string, fallback: string, required: boolean): string {
  const value = env[key]?.trim();
  if (!value) {
    if (required) throw new Error(`${key} is required`);
    return fallback;
  }
  if (value.length > 256) throw new Error(`${key} must be at most 256 characters`);
  if (/[\r\n]/.test(value)) throw new Error(`${key} cannot contain line breaks`);
  return value;
}

function emailValue(env: NodeJS.ProcessEnv, production: boolean): string {
  const email = profileValue(env, "STATIC_USER_EMAIL", localDefaults.email, production);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("STATIC_USER_EMAIL must be an email address");
  return email;
}

function booleanValue(env: NodeJS.ProcessEnv, key: string, fallback: boolean, required: boolean): boolean {
  const value = env[key]?.trim();
  if (!value) {
    if (required) throw new Error(`${key} is required`);
    return fallback;
  }
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be true or false`);
}

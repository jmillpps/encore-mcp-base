export interface UserProfile {
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

export function userProfileFromClaims(claims: UserProfileClaims): UserProfile {
  return validateUserProfile(claims);
}

export function userProfileFromJson(value: string): UserProfile {
  try {
    return validateUserProfile(JSON.parse(value));
  } catch {
    throw new Error("user profile is malformed");
  }
}

export function userProfileJson(user: UserProfile): string {
  return JSON.stringify(validateUserProfile(user));
}

export function userProfileFromUpstream(value: unknown): UserProfile {
  return validateUserProfile(value);
}

function validateUserProfile(value: unknown): UserProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("user profile is malformed");
  const record = value as Record<string, unknown>;
  const givenName = optionalProfileClaim(record.given_name, "given_name") ?? "Authenticated";
  const familyName = optionalProfileClaim(record.family_name, "family_name") ?? "User";
  const email = emailClaim(record.email);
  return {
    sub: requiredProfileClaim(record.sub, "sub"),
    given_name: givenName,
    family_name: familyName,
    name: optionalProfileClaim(record.name, "name") ?? `${givenName} ${familyName}`.trim(),
    preferred_username: optionalProfileClaim(record.preferred_username, "preferred_username") ?? email,
    email,
    email_verified: booleanClaim(record.email_verified),
  };
}

function requiredProfileClaim(value: unknown, name: string): string {
  const parsed = optionalProfileClaim(value, name);
  if (!parsed) throw new Error(`${name} is required`);
  return parsed;
}

function optionalProfileClaim(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 256) throw new Error(`${name} must be at most 256 characters`);
  if (/[\r\n]/.test(trimmed)) throw new Error(`${name} cannot contain line breaks`);
  return trimmed;
}

function emailClaim(value: unknown): string {
  const email = optionalProfileClaim(value, "email");
  if (!email) throw new Error("email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email must be an email address");
  return email;
}

function booleanClaim(value: unknown): boolean {
  if (value === undefined || value === null) throw new Error("email_verified is required");
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("email_verified must be true or false");
}

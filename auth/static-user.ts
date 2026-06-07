export interface StaticUser {
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

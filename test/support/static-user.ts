import type { StaticUser } from "../../auth/static-user.ts";

export const testStaticUser: StaticUser = {
  sub: "user_example",
  given_name: "Example",
  family_name: "User",
  name: "Example User",
  preferred_username: "example.user",
  email: "user@example.test",
  email_verified: true,
};

export const testStaticUserEnv: NodeJS.ProcessEnv = {
  STATIC_USER_SUB: testStaticUser.sub,
  STATIC_USER_GIVEN_NAME: testStaticUser.given_name,
  STATIC_USER_FAMILY_NAME: testStaticUser.family_name,
  STATIC_USER_NAME: testStaticUser.name,
  STATIC_USER_PREFERRED_USERNAME: testStaticUser.preferred_username,
  STATIC_USER_EMAIL: testStaticUser.email,
  STATIC_USER_EMAIL_VERIFIED: String(testStaticUser.email_verified),
};

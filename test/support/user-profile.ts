import type { UserProfile } from "../../auth/user-profile.ts";

export const testUserProfile: UserProfile = {
  sub: "user_example",
  given_name: "Example",
  family_name: "User",
  name: "Example User",
  preferred_username: "example.user",
  email: "user@example.test",
  email_verified: true,
};

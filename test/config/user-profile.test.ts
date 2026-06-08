import assert from "node:assert/strict";
import test from "node:test";
import { userProfileFromUpstream } from "../../auth/user-profile.ts";
import { testUserProfile } from "../support/user-profile.ts";

test("upstream userinfo produces the service user profile", () => {
  assert.deepEqual(userProfileFromUpstream(testUserProfile), testUserProfile);
});

test("upstream userinfo can derive display fields from required claims", () => {
  assert.deepEqual(userProfileFromUpstream({
    sub: "subject-1",
    email: "subject@example.test",
    email_verified: true,
  }), {
    sub: "subject-1",
    given_name: "Authenticated",
    family_name: "User",
    name: "Authenticated User",
    preferred_username: "subject@example.test",
    email: "subject@example.test",
    email_verified: true,
  });
});

test("upstream userinfo requires stable identity and email verification claims", () => {
  assert.throws(() => userProfileFromUpstream({ ...testUserProfile, sub: "" }), /sub is required/);
  assert.throws(() => userProfileFromUpstream({ ...testUserProfile, email: "invalid" }), /email must be an email address/);
  assert.throws(() => userProfileFromUpstream({ ...testUserProfile, email_verified: undefined }), /email_verified is required/);
  assert.throws(() => userProfileFromUpstream({ ...testUserProfile, name: "bad\nname" }), /name cannot contain line breaks/);
});

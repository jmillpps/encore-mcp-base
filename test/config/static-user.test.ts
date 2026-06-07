import assert from "node:assert/strict";
import test from "node:test";
import { readStaticUser } from "../../auth/static-user.ts";
import { testStaticUser, testStaticUserEnv } from "../support/static-user.ts";

test("static user uses generic local defaults", () => {
  assert.deepEqual(readStaticUser({}), testStaticUser);
});

test("production static user requires explicit identity values", () => {
  assert.deepEqual(readStaticUser({ NODE_ENV: "production", ...testStaticUserEnv }), testStaticUser);
  assert.throws(() => readStaticUser({ NODE_ENV: "production", ...testStaticUserEnv, STATIC_USER_SUB: "" }), /STATIC_USER_SUB is required/);
  assert.throws(() => readStaticUser({ NODE_ENV: "production", ...testStaticUserEnv, STATIC_USER_NAME: "" }), /STATIC_USER_NAME is required/);
  assert.throws(() => readStaticUser({ NODE_ENV: "production", ...testStaticUserEnv, STATIC_USER_EMAIL: "invalid" }), /STATIC_USER_EMAIL must be an email address/);
  assert.throws(() => readStaticUser({ NODE_ENV: "production", ...testStaticUserEnv, STATIC_USER_EMAIL_VERIFIED: "yes" }), /STATIC_USER_EMAIL_VERIFIED must be true or false/);
});

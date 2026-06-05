import { api } from "encore.dev/api";
import { staticUser, type StaticUser } from "../auth/static-user.ts";

export const profile = api<void, StaticUser>({ expose: true, auth: true, method: "GET", path: "/actions/profile" }, async () => {
  return staticUser;
});

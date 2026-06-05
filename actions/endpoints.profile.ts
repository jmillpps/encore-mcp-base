import { api, Header } from "encore.dev/api";
import { staticUser, type StaticUser } from "../auth/static-user.ts";
import { verifyActionBearer } from "./action-bearer.ts";

interface ProfileRequest {
  authorization: Header<"Authorization">;
}

export const profile = api<ProfileRequest, StaticUser>({ expose: true, auth: true, method: "GET", path: "/actions/profile" }, async (request) => {
  verifyActionBearer(request.authorization, ["openid", "profile", "email"]);
  return staticUser;
});

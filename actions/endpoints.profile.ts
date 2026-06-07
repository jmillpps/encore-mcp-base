import { api, Header, Query } from "encore.dev/api";
import { staticUser, type StaticUser } from "../auth/static-user.ts";
import { rejectActionAccessTokenQuery, verifyActionBearer } from "./action-bearer.ts";

interface ProfileRequest {
  authorization: Header<"Authorization">;
  access_token?: Query<string>;
}

export const profile = api<ProfileRequest, StaticUser>({ expose: true, auth: true, method: "GET", path: "/actions/profile" }, async (request) => {
  rejectActionAccessTokenQuery(request.access_token);
  verifyActionBearer(request.authorization, ["openid", "profile", "email"]);
  return staticUser;
});

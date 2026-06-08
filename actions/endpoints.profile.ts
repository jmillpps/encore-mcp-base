import { api, Header, Query } from "encore.dev/api";
import { userProfileFromClaims, type UserProfile } from "../auth/user-profile.ts";
import { rejectActionAccessTokenQuery, verifyActionBearer } from "./action-bearer.ts";

interface ProfileRequest {
  authorization: Header<"Authorization">;
  access_token?: Query<string>;
}

export const profile = api<ProfileRequest, UserProfile>({ expose: true, auth: true, method: "GET", path: "/actions/profile" }, async (request) => {
  rejectActionAccessTokenQuery(request.access_token);
  const claims = verifyActionBearer(request.authorization, ["openid", "profile", "email"]);
  return userProfileFromClaims(claims);
});

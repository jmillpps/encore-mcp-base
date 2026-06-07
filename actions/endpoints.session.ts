import { api, Header, Query } from "encore.dev/api";
import { rejectActionAccessTokenQuery, verifyActionBearer } from "./action-bearer.ts";

interface SessionRequest {
  authorization: Header<"Authorization">;
  access_token?: Query<string>;
}

export interface SessionResponse {
  subject: string;
  clientId: string;
  audience: string;
  scopes: string[];
}

export const session = api<SessionRequest, SessionResponse>(
  { expose: true, auth: true, method: "GET", path: "/actions/session" },
  async (request) => {
    rejectActionAccessTokenQuery(request.access_token);
    const claims = verifyActionBearer(request.authorization, ["openid"]);
    return {
      subject: claims.sub,
      clientId: claims.client_id,
      audience: claims.aud,
      scopes: claims.scope.split(/\s+/).filter(Boolean),
    };
  },
);

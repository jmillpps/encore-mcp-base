import { api, Header } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { verifyBearer } from "../auth/bearer.ts";

interface SessionRequest {
  authorization: Header<"Authorization">;
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
    const config = readConfig();
    const claims = verifyBearer(config, request.authorization, config.actionsAudience);
    return {
      subject: claims.sub,
      clientId: claims.client_id,
      audience: claims.aud,
      scopes: claims.scope.split(/\s+/).filter(Boolean),
    };
  },
);

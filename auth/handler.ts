import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { readConfig } from "../shared/config.ts";
import { verifyBearer } from "./bearer.ts";

interface AuthParams {
  authorization: Header<"Authorization">;
}

export interface AuthData {
  userID: string;
  clientID: string;
  scopes: string[];
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  try {
    const config = readConfig();
    const claims = verifyBearer(config, params.authorization, config.actionsAudience);
    return { userID: claims.sub, clientID: claims.client_id, scopes: claims.scope.split(/\s+/).filter(Boolean) };
  } catch {
    throw APIError.unauthenticated("invalid bearer token");
  }
});

export const gateway = new Gateway({ authHandler: auth });

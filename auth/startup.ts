import { readConfig } from "../shared/config.ts";
import { loadClients } from "./clients.ts";
import { resolveStorePath } from "./storage/store-path.ts";
import { readStaticUser } from "./static-user.ts";
import { getSigningKey } from "./tokens/signing-keys.ts";

export function validateStartup(env: NodeJS.ProcessEnv = process.env): void {
  const config = readConfig(env);
  resolveStorePath(config.oauthStorePath);
  loadClients(config, env);
  if (!config.cognito.enabled) readStaticUser(env);
  getSigningKey(config, env);
}

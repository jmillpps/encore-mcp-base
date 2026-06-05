import { readConfig } from "../shared/config.ts";
import { loadClients } from "./clients.ts";
import { getSigningKey } from "./tokens/signing-keys.ts";

export function validateStartup(env: NodeJS.ProcessEnv = process.env): void {
  const config = readConfig(env);
  loadClients(config, env);
  getSigningKey(config, env);
}

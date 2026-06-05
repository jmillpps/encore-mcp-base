import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { readForm, writeError, writeJson } from "../shared/http.ts";
import { loadClients } from "./clients.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { handleTokenGrant } from "./token.ts";

export const token = api.raw({ expose: true, method: "POST", path: "/oauth/token" }, async (req, res) => {
  try {
    const config = readConfig();
    const body = await handleTokenGrant(
      config,
      new DiskOAuthStore(config.oauthStorePath),
      loadClients(config),
      await readForm(req),
      String(req.headers.authorization ?? ""),
    );
    writeJson(res, 200, body, { "cache-control": "no-store", pragma: "no-cache" });
  } catch (error) {
    writeError(res, error);
  }
});

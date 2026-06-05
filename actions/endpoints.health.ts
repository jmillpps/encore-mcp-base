import { api } from "encore.dev/api";
import { isoNow } from "../shared/time.ts";

export interface HealthResponse {
  status: string;
  service: string;
  time: string;
}

export const health = api<void, HealthResponse>({ expose: true, method: "GET", path: "/health" }, async () => {
  return { status: "ok", service: "gpt-mcp-service", time: isoNow() };
});

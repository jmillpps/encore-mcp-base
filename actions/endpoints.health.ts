import { api } from "encore.dev/api";
import { publicHealthSnapshot, type PublicHealthSnapshot } from "../shared/service-health.ts";

export const health = api<void, PublicHealthSnapshot>({ expose: true, method: "GET", path: "/health" }, async () => {
  return publicHealthSnapshot();
});

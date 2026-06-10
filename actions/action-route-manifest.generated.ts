import type { ActionRoute } from "./action-contract.ts";

export const actionRouteManifest = [
  { name: "health", method: "GET", path: "/health", auth: false },
  { name: "profile", method: "GET", path: "/actions/profile", auth: true },
  { name: "session", method: "GET", path: "/actions/session", auth: true },
] as const satisfies readonly ActionRoute[];

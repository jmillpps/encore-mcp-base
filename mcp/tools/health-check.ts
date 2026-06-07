import { serviceName, serviceVersion } from "../../shared/service-info.ts";
import { isoNow } from "../../shared/time.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool } from "../tool-types.ts";

export const healthCheckTool: McpTool = {
  name: "health.check",
  title: "Health Check",
  description: "Use this when ChatGPT needs to confirm the MCP service is reachable.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema("Service health response.", {
    status: stringSchema("Fixed status value returned by a reachable service."),
    timestamp: stringSchema("ISO timestamp when the health check was produced."),
    service: objectSchema("Service identity returned by the health check.", {
      name: stringSchema("Service package name."),
      version: stringSchema("Service package version."),
    }),
  }),
  annotations: readOnlyToolAnnotations(),
  invocation: { invoking: "Checking service health", invoked: "Service health ready" },
  requiredScopes: [],
  run: async () => {
    const structuredContent = {
      status: "ok",
      timestamp: isoNow(),
      service: { name: serviceName, version: serviceVersion },
    };
    return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
  },
};

import { serviceName, serviceVersion } from "../../shared/service-info.ts";
import { isoNow } from "../../shared/time.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool } from "../tool-types.ts";

export const healthCheckTool: McpTool = {
  name: "health.check",
  title: "Health Check",
  description: "Check whether the service is reachable.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema({
    status: stringSchema(),
    timestamp: stringSchema(),
    service: objectSchema({ name: stringSchema(), version: stringSchema() }),
  }),
  annotations: readOnlyToolAnnotations(),
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

import { serviceHealthSnapshot } from "../../shared/service-health.ts";
import { toolUiResource } from "../app-ui.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool } from "../tool-types.ts";
import { healthStatusCardUri } from "../widgets/index.ts";

export const healthStatusCardTool: McpTool = {
  name: "health.status_card",
  title: "Health Status Card",
  description: "Use this when ChatGPT should render the service health status as an inline UI card.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema("Service health UI response.", {
    status: stringSchema("Fixed status value returned by a reachable service."),
    timestamp: stringSchema("ISO timestamp when the health status card was produced."),
    service: objectSchema("Service identity returned by the health status card.", {
      name: stringSchema("Service package name."),
      version: stringSchema("Service package version."),
    }),
  }),
  annotations: readOnlyToolAnnotations(),
  invocation: { invoking: "Rendering health status", invoked: "Health status ready" },
  requiredScopes: [],
  ui: toolUiResource(healthStatusCardUri),
  run: async () => {
    const structuredContent = serviceHealthSnapshot();
    return { content: [{ type: "text", text: "Showing the service health status card." }], structuredContent };
  },
};

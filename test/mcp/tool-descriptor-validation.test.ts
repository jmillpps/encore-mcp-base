import assert from "node:assert/strict";
import test from "node:test";
import { ServiceError } from "../../shared/errors.ts";
import { readOnlyToolAnnotations } from "../../mcp/tool-annotations.ts";
import { listTools, tools, type McpTool } from "../../mcp/tool-registry.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../../mcp/tool-schemas.ts";

test("listTools rejects malformed tool descriptors before exposure", () => {
  for (const [index, patch] of [
    { annotations: { readOnlyHint: "yes" } },
    { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true } },
    { annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
    { annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false } },
    { annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false } },
    { requiredScopes: ["bad scope"] },
    { invocation: { invoking: "", invoked: "Done" } },
    { invocation: { invoking: "x".repeat(65), invoked: "Done" } },
    { invocation: { invoking: "Running", invoked: "Done", extra: true } },
    { inputSchema: { type: "string" } },
    { outputSchema: { type: "array" } },
    { icons: [{ src: "javascript:alert(1)" }] },
    { run: "not-a-function" },
  ].entries()) {
    const tool = { ...baseTool(index), ...patch } as unknown as McpTool;
    tools.push(tool);
    try {
      assert.throws(
        () => listTools(),
        (error) => error instanceof ServiceError && error.code === "server_error" && error.status === 500 && error.message === "invalid tool descriptor",
      );
    } finally {
      tools.splice(tools.indexOf(tool), 1);
    }
  }
});

test("listTools exposes valid tool descriptor icons", () => {
  const tool = { ...baseTool(1000), icons: [{ src: "data:image/png;base64,AQID", mimeType: "image/png", sizes: ["48x48"], theme: "light" }] } as McpTool;
  tools.push(tool);
  try {
    const listed = listTools().tools as Record<string, unknown>[];
    const descriptor = listed.find((candidate) => candidate.name === tool.name);
    assert.deepEqual(descriptor?.icons, tool.icons);
  } finally {
    tools.splice(tools.indexOf(tool), 1);
  }
});

function baseTool(index: number): McpTool {
  return {
    name: `test.descriptor-${index}`,
    title: "Descriptor Test",
    description: "Validate descriptor shape.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema({ status: stringSchema() }),
    annotations: readOnlyToolAnnotations(),
    invocation: { invoking: "Running descriptor test", invoked: "Descriptor test ready" },
    requiredScopes: [],
    run: async () => ({ content: [{ type: "text", text: "ok" }], structuredContent: { status: "ok" } }),
  };
}

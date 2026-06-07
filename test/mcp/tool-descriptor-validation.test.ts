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
    { inputSchema: { type: "string" } },
    { outputSchema: { type: "array" } },
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

function baseTool(index: number): McpTool {
  return {
    name: `test.descriptor-${index}`,
    title: "Descriptor Test",
    description: "Validate descriptor shape.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema({ status: stringSchema() }),
    annotations: readOnlyToolAnnotations(),
    requiredScopes: [],
    run: async () => ({ content: [{ type: "text", text: "ok" }], structuredContent: { status: "ok" } }),
  };
}

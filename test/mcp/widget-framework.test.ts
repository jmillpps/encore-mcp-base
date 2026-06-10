import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { ServiceError } from "../../shared/errors.ts";
import { readConfig } from "../../shared/config.ts";
import { defineToolResultCardWidget, toolResultCardBaseStylePath, widgetBridgeScriptPath } from "../../mcp/widgets/tool-result-card.ts";
import { widgetAssets } from "../../mcp/widgets/index.ts";
import { defineWidget, defineWidgetBase, scriptAsset, styleAsset } from "../../mcp/widgets/widget-definition.ts";
import type { McpResourceDefinition } from "../../mcp/resource-types.ts";

test("widget framework composes base assets, child assets, and CSP metadata", async () => {
  const base = defineWidgetBase({
    assets: [styleAsset("/app-ui/framework-base-v1.css", "body { margin: 0; }")],
    widget: {
      prefersBorder: true,
      ui: { baseRole: "card" },
      csp: {
        connectDomains: ["https://api.example.test"],
        resourceDomains: ["https://static.example.test"],
        frameDomains: ["https://frames.example.test"],
        redirectDomains: ["https://redirect.example.test"],
      },
    },
  });
  const widget = defineWidget({
    base,
    resourceUri: "ui://widget/framework-card-v1.html",
    name: "framework-card",
    title: "Framework Card",
    description: "Test framework card.",
    markup: "<main><h1>Framework</h1></main>",
    assets: [scriptAsset("/app-ui/framework-card-v1.js", "globalThis.frameworkCard = true;")],
    widget: {
      description: "Framework card description.",
      ui: { childRole: "example" },
      csp: {
        connectDomains: ["https://child-api.example.test"],
        resourceDomains: ["https://child-static.example.test"],
      },
    },
  });

  assert.deepEqual(widget.assets.map((asset) => asset.path), ["/app-ui/framework-base-v1.css", "/app-ui/framework-card-v1.js"]);
  const content = await firstContent(widget.resource.contents);
  assert.match(String(content.text), /https:\/\/widgets\.example\.test\/app-ui\/framework-base-v1\.css/);
  assert.match(String(content.text), /https:\/\/widgets\.example\.test\/app-ui\/framework-card-v1\.js/);
  const meta = requireRecord(content._meta);
  const ui = requireRecord(meta.ui);
  assert.equal(ui.prefersBorder, true);
  assert.equal(ui.baseRole, "card");
  assert.equal(ui.childRole, "example");
  const csp = requireRecord(ui.csp);
  assert.deepEqual(csp.connectDomains, ["https://api.example.test", "https://child-api.example.test"]);
  assert.deepEqual(csp.resourceDomains, ["https://static.example.test", "https://child-static.example.test"]);
  assert.deepEqual(csp.frameDomains, ["https://frames.example.test"]);
  assert.equal(meta["openai/widgetDescription"], "Framework card description.");
  assert.equal(meta["openai/widgetPrefersBorder"], true);
  const openAiCsp = requireRecord(meta["openai/widgetCSP"]);
  assert.deepEqual(openAiCsp.connect_domains, ["https://api.example.test", "https://child-api.example.test"]);
  assert.deepEqual(openAiCsp.resource_domains, ["https://static.example.test", "https://child-static.example.test"]);
  assert.deepEqual(openAiCsp.frame_domains, ["https://frames.example.test"]);
  assert.deepEqual(openAiCsp.redirect_domains, ["https://redirect.example.test"]);
});

test("tool result card widgets inherit shared bridge and base card assets", async () => {
  const widget = defineToolResultCardWidget({
    resourceUri: "ui://widget/example-tool-card-v1.html",
    name: "example-tool-card",
    title: "Example Tool Card",
    description: "Example tool result card.",
    widgetDescription: "Example widget description.",
    stylePath: "/app-ui/example-tool-card-v1.css",
    scriptPath: "/app-ui/example-tool-card-v1.js",
    theme: {
      pageBackground: "#ffffff",
      cardBackground: "linear-gradient(145deg, #ffffff, #f1f5f9)",
      borderColor: "#cbd5e1",
      textColor: "#0f172a",
      mutedColor: "#475569",
      accentColor: "#0f766e",
      accentTextColor: "white",
    },
    header: {
      title: "Example card",
      titlePath: "title",
      titleFallback: "Example card",
      subtitlePath: "summary",
      subtitleFallback: "Waiting for data",
      avatarPath: "title",
      avatarFallback: "?",
    },
    fields: [{ label: "Owner", id: "owner", path: "owner.name", fallback: "Unavailable" }],
  });

  assert.deepEqual(widget.assets.map((asset) => asset.path), [
    toolResultCardBaseStylePath,
    widgetBridgeScriptPath,
    "/app-ui/example-tool-card-v1.css",
    "/app-ui/example-tool-card-v1.js",
  ]);
  const html = String((await firstContent(widget.resource.contents)).text);
  assert.equal(html.includes("<style"), false);
  assert.match(html, /https:\/\/widgets\.example\.test\/app-ui\/example-tool-card-v1\.css/);
  assert.match(html, /https:\/\/widgets\.example\.test\/app-ui\/example-tool-card-v1\.js/);
  assert.match(widget.assets.find((asset) => asset.path === widgetBridgeScriptPath)?.body ?? "", /globalThis\.mcpWidget/);
  assert.match(widget.assets.find((asset) => asset.path === "/app-ui/example-tool-card-v1.js")?.body ?? "", /owner\.name/);
});

test("tool result card bridge rerenders when ChatGPT delivers tool output globals after mount", () => {
  const calls: unknown[] = [];
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const sandbox = {
    document: { querySelector: () => undefined },
    parent: {},
    openai: {},
    addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
  };
  Object.assign(sandbox, { window: sandbox });
  vm.runInNewContext(bridgeScriptBody(), sandbox);
  const widget = (sandbox as unknown as { mcpWidget: { onToolResult: (render: (data: unknown) => void) => void } }).mcpWidget;

  widget.onToolResult((data) => calls.push(data));
  assert.deepEqual(plain(calls), [{}]);
  listeners.get("openai:set_globals")?.({ detail: { globals: { toolOutput: { name: "Example User", preferred_username: "casey@example.test" } } } });
  assert.deepEqual(plain(calls.at(-1)), { name: "Example User", preferred_username: "casey@example.test" });
});

test("tool result card bridge rerenders from MCP tool-result notifications", () => {
  const calls: unknown[] = [];
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const parent = {};
  const sandbox = {
    document: { querySelector: () => undefined },
    parent,
    openai: {},
    addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
  };
  Object.assign(sandbox, { window: sandbox });
  vm.runInNewContext(bridgeScriptBody(), sandbox);
  const widget = (sandbox as unknown as { mcpWidget: { onToolResult: (render: (data: unknown) => void) => void } }).mcpWidget;

  widget.onToolResult((data) => calls.push(data));
  listeners.get("message")?.({ source: parent, data: { jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: { email: "casey@example.test" } } } });
  assert.deepEqual(plain(calls.at(-1)), { email: "casey@example.test" });
});

test("widget framework rejects unsafe declarations", () => {
  assert.throws(() => defineWidget({
    resourceUri: "ui://widget/unsafe-v1.html",
    name: "unsafe",
    title: "Unsafe",
    description: "Unsafe widget.",
    markup: "<main onclick=\"alert(1)\">Unsafe</main>",
    assets: [scriptAsset("/app-ui/unsafe-v1.js", "globalThis.unsafe = true;")],
  }), ServiceError);

  const base = defineWidgetBase({ assets: [styleAsset("/app-ui/conflict-v1.css", "body { margin: 0; }")] });
  assert.throws(() => defineWidget({
    base,
    resourceUri: "ui://widget/conflict-v1.html",
    name: "conflict",
    title: "Conflict",
    description: "Conflict widget.",
    markup: "<main>Conflict</main>",
    assets: [styleAsset("/app-ui/conflict-v1.css", "body { padding: 0; }")],
  }), ServiceError);

  assert.throws(() => defineToolResultCardWidget({
    resourceUri: "ui://widget/bad-card-v1.html",
    name: "bad-card",
    title: "Bad Card",
    description: "Bad card.",
    widgetDescription: "Bad card.",
    stylePath: "/app-ui/bad-card-v1.css",
    scriptPath: "/app-ui/bad-card-v1.js",
    theme: {
      pageBackground: "url(https://evil.example/card.png)",
      cardBackground: "#ffffff",
      borderColor: "#ffffff",
      textColor: "#000000",
      mutedColor: "#000000",
      accentColor: "#000000",
      accentTextColor: "#ffffff",
    },
    header: { title: "Bad card" },
    fields: [{ label: "Bad", id: "bad id", path: "bad", fallback: "Bad" }],
  }), ServiceError);
});

function requireRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function bridgeScriptBody(): string {
  const asset = widgetAssets.find((candidate) => candidate.path === widgetBridgeScriptPath);
  assert.ok(asset);
  return asset.body;
}

function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

async function firstContent(contents: McpResourceDefinition["contents"]): Promise<Record<string, unknown>> {
  const resolved = Array.isArray(contents) ? contents : await contents({ config: readConfig({ WIDGET_DOMAIN: "https://widgets.example.test" }), rateLimitSubject: "test" });
  assert.ok(Array.isArray(resolved));
  return requireRecord(resolved[0]);
}

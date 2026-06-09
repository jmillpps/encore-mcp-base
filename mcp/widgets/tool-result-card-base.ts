import { defineWidgetBase, scriptAsset, styleAsset } from "./widget-definition.ts";

export const widgetBridgeScriptPath = "/app-ui/mcp-widget-bridge-v2.js";
export const toolResultCardBaseStylePath = "/app-ui/tool-result-card-base-v1.css";

export const toolResultCardBase = defineWidgetBase({
  assets: [
    styleAsset(toolResultCardBaseStylePath, `
:root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: var(--widget-page-background); color: var(--widget-text-color); }
.widget-page { min-height: 100vh; box-sizing: border-box; padding: 24px; display: grid; place-items: center; }
.widget-card { width: min(100%, 520px); border: 1px solid var(--widget-border-color); border-radius: 24px; background: var(--widget-card-background); box-shadow: 0 22px 60px rgb(21 34 47 / 14%); padding: 24px; }
.widget-eyebrow { color: var(--widget-muted-color); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin: 0; }
.widget-avatar { width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; background: var(--widget-accent-color); color: var(--widget-accent-text-color); font-size: 28px; font-weight: 800; margin-bottom: 18px; }
.widget-title { margin: 12px 0 8px; font-size: clamp(28px, 7vw, 44px); line-height: .95; letter-spacing: -.05em; }
.widget-subtitle { margin: 0; color: var(--widget-muted-color); }
.widget-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; border-radius: 999px; background: var(--widget-accent-color); color: var(--widget-accent-text-color); padding: 10px 14px; font-weight: 700; }
.widget-dot { width: 10px; height: 10px; border-radius: 999px; background: currentColor; box-shadow: 0 0 0 6px rgb(255 255 255 / 18%); }
.widget-fields { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; margin: 24px 0 0; font-size: 14px; }
.widget-fields dt { color: var(--widget-muted-color); }
.widget-fields dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
`.trim()),
    scriptAsset(widgetBridgeScriptPath, `
(function () {
  function valueAt(source, path) {
    return path.split(".").reduce(function (value, key) {
      return value && typeof value === "object" ? value[key] : undefined;
    }, source);
  }
  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }
  function initialData() {
    return dataFromBridge(globalThis.openai) ?? {};
  }
  function dataFromBridge(bridge) {
    if (!bridge || typeof bridge !== "object") return undefined;
    return objectData(bridge.toolOutput) ?? objectData(bridge.structuredContent) ?? objectData(bridge.toolResponseMetadata?.mcp_tool_result?.structuredContent) ?? objectData(bridge.toolResponseMetadata?.call_tool_result?.structuredContent);
  }
  function objectData(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  }
  function renderData(render, value) {
    render(objectData(value) ?? {});
  }
  function onToolResult(render) {
    renderData(render, initialData());
    window.addEventListener("openai:set_globals", function (event) {
      const data = dataFromBridge(event.detail?.globals);
      if (data) render(data);
    }, { passive: true });
    window.addEventListener("message", function (event) {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method !== "ui/notifications/tool-result") return;
      renderData(render, message.params?.structuredContent);
    }, { passive: true });
  }
  globalThis.mcpWidget = { onToolResult, setText, valueAt };
}());
`.trim()),
  ],
  widget: {
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  },
});

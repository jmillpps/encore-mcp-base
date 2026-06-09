import type { ToolResultCardTheme, ToolResultCardWidgetOptions } from "./tool-result-card-types.ts";

export function cardMarkup(options: ToolResultCardWidgetOptions): string {
  return `
<main class="widget-page">
  <section class="widget-card">
    ${options.header.avatarPath ? `<div class="widget-avatar" id="avatar">${escapeHtml(options.header.avatarFallback ?? "?")}</div>` : ""}
    ${options.header.eyebrow ? `<p class="widget-eyebrow">${escapeHtml(options.header.eyebrow)}</p>` : ""}
    <h1 class="widget-title" id="title">${escapeHtml(options.header.title)}</h1>
    <p class="widget-subtitle" id="subtitle">${escapeHtml(options.header.subtitle ?? options.header.subtitleFallback ?? "")}</p>
    ${options.status ? `<p class="widget-status"><span class="widget-dot"></span><span id="status">${escapeHtml(options.status.fallback)}</span></p><p class="widget-subtitle" id="summary">${escapeHtml(options.status.waitingSummary)}</p>` : ""}
    <dl class="widget-fields">
      ${options.fields.map((field) => `<dt>${escapeHtml(field.label)}</dt><dd id="${escapeHtml(field.id)}">${escapeHtml(field.fallback)}</dd>`).join("\n      ")}
    </dl>
  </section>
</main>
`;
}

export function rendererScript(options: ToolResultCardWidgetOptions): string {
  return `
(function () {
  const config = ${JSON.stringify(rendererConfig(options))};
  const widget = globalThis.mcpWidget;
  function text(value, fallback) {
    return typeof value === "string" && value.trim() ? value : fallback;
  }
  function formatted(value, field) {
    if (field.format === "verified") return value === true ? "Verified" : field.fallback;
    return text(value, field.fallback);
  }
  function render(data) {
    const source = data && typeof data === "object" ? data : {};
    if (config.header.avatarPath) {
      const name = text(widget.valueAt(source, config.header.avatarPath), config.header.avatarFallback);
      widget.setText("#avatar", name.trim().charAt(0).toUpperCase() || "?");
    }
    widget.setText("#title", text(widget.valueAt(source, config.header.titlePath), config.header.title));
    widget.setText("#subtitle", text(widget.valueAt(source, config.header.subtitlePath), config.header.subtitle));
    if (config.status) {
      const status = text(widget.valueAt(source, config.status.path), config.status.fallback);
      widget.setText("#status", status);
      widget.setText("#summary", status === config.status.okValue ? config.status.okSummary : config.status.waitingSummary);
    }
    for (const field of config.fields) {
      widget.setText("#" + field.id, formatted(widget.valueAt(source, field.path), field));
    }
  }
  widget.onToolResult(render);
}());
`.trim();
}

export function themeCss(theme: ToolResultCardTheme): string {
  return `
:root {
  --widget-page-background: ${theme.pageBackground};
  --widget-card-background: ${theme.cardBackground};
  --widget-border-color: ${theme.borderColor};
  --widget-text-color: ${theme.textColor};
  --widget-muted-color: ${theme.mutedColor};
  --widget-accent-color: ${theme.accentColor};
  --widget-accent-text-color: ${theme.accentTextColor};
}
`.trim();
}

function rendererConfig(options: ToolResultCardWidgetOptions): Record<string, unknown> {
  return {
    header: {
      title: options.header.titleFallback ?? options.header.title,
      titlePath: options.header.titlePath ?? "",
      subtitle: options.header.subtitleFallback ?? options.header.subtitle ?? "",
      subtitlePath: options.header.subtitlePath ?? "",
      avatarPath: options.header.avatarPath ?? "",
      avatarFallback: options.header.avatarFallback ?? "?",
    },
    status: options.status,
    fields: options.fields,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

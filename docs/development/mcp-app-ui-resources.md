# MCP Apps UI Resources

Use this guide when an MCP tool renders a ChatGPT inline component.

## Runtime Ownership

| Runtime area | Owning files |
| --- | --- |
| UI resource types | `mcp/resource-types.ts` |
| UI resource builders | `mcp/app-ui.ts` |
| Widget composition | `mcp/widgets/widget-definition.ts` |
| Shared card framework | `mcp/widgets/tool-result-card*.ts` |
| Concrete widgets | `mcp/widgets/` |
| Resource validation | `mcp/resource-validation.ts` |
| Resource registry | `mcp/resource-registry.ts` |
| Widget asset routes | `mcp/endpoints.widget-assets.ts` |
| Render tools | `mcp/tools/` |
| Protocol dispatch | `mcp/protocol.ts` |

## Resource Contract

Every UI resource has a stable URI, MIME type, HTML content, metadata, and optional scopes. The UI MIME type is `text/html;profile=mcp-app`. The URI is the cache key used by ChatGPT. Change the URI when the HTML, JavaScript, CSS, or data contract changes in a breaking way.

Use `ui://widget/name-v1.html` for service-hosted component templates. Use versioned `/app-ui/name-v1.js` and `/app-ui/name-v1.css` paths for browser assets.

The service applies the configured widget origin during `resources/read`. The origin appears as `_meta.ui.domain` and `_meta["openai/widgetDomain"]`.

The service adds the configured widget origin to `_meta.ui.csp.resourceDomains` and `_meta["openai/widgetCSP"].resource_domains` during `resources/read`. ChatGPT can load the first-party JavaScript and CSS assets from that origin.

## Framework Layers

The widget framework has three layers.

| Layer | Builder | Use |
| --- | --- | --- |
| Low-level widget | `defineWidget` | Custom HTML resources with explicit markup, assets, metadata, scopes, and CSP. |
| Base widget | `defineWidgetBase` | Reusable asset and metadata bundles inherited by multiple widgets. |
| Tool-result card | `defineToolResultCardWidget` | Declarative cards that render MCP tool `structuredContent`. |

`defineWidget` validates the widget declaration, rejects inline script, inline style, and inline event handlers, merges inherited assets, adds asset tags, and returns the resource definition.

`defineWidgetBase` creates a reusable bundle of assets and widget metadata. A base can declare shared JavaScript, shared CSS, border preference, standard UI metadata, and CSP. A derived widget inherits the base and adds its own markup, assets, scopes, and metadata.

`defineToolResultCardWidget` inherits `toolResultCardBase`. The base provides `mcpWidget`, a small browser bridge that reads `window.openai.toolOutput`, structured content fallbacks, and `ui/notifications/tool-result` messages. Derived cards provide field mappings, text, theme tokens, scopes, and CSP additions.

## Developer Flow

1. Place shared capability data under `shared/` or the domain module that owns the data.
2. Choose `defineToolResultCardWidget` for field-based cards.
3. Choose `defineWidget` with `defineWidgetBase` for custom layouts or interactive bundles.
4. Export a versioned resource URI and versioned asset paths from the widget module.
5. Register the widget in `mcp/widgets/index.ts`.
6. Expose every asset through an exact public route in `mcp/endpoints.widget-assets.ts`.
7. Create or update the render tool under `mcp/tools/`.
8. Attach the resource URI with `toolUiResource`.
9. Register the tool in `mcp/tool-registry.ts`.
10. Add focused tests under `test/mcp/`.
11. Update MCP API docs, GPT Apps setup docs, capability docs, and security docs.

## Tool-Result Cards

Use `defineToolResultCardWidget` when the component renders a known set of fields from tool `structuredContent`.

```ts
import { defineToolResultCardWidget } from "./tool-result-card.ts";

export const accountCardUri = "ui://widget/account-card-v1.html";
export const accountCardStylePath = "/app-ui/account-card-v1.css";
export const accountCardScriptPath = "/app-ui/account-card-v1.js";

export const accountCardWidget = defineToolResultCardWidget({
  resourceUri: accountCardUri,
  name: "account-card",
  title: "Account Card",
  description: "Renderable UI resource for account details.",
  widgetDescription: "Shows account details returned by the service.",
  stylePath: accountCardStylePath,
  scriptPath: accountCardScriptPath,
  requiredScopes: ["openid", "profile", "email"],
  theme: {
    pageBackground: "#f8fafc",
    cardBackground: "linear-gradient(145deg, #ffffff, #eef2ff)",
    borderColor: "#cbd5e1",
    textColor: "#0f172a",
    mutedColor: "#475569",
    accentColor: "#0f766e",
    accentTextColor: "white",
  },
  header: {
    title: "Account",
    titlePath: "name",
    titleFallback: "Account",
    subtitlePath: "email",
    subtitleFallback: "Waiting for account data",
    avatarPath: "name",
    avatarFallback: "?",
  },
  fields: [
    { label: "Subject", id: "subject", path: "sub", fallback: "Unavailable" },
    { label: "Plan", id: "plan", path: "plan.name", fallback: "Unavailable" },
  ],
});
```

Field IDs become DOM IDs. Use letters, numbers, `_`, and `-`. Data paths use dot-separated property names. Theme values accept color and gradient values without external URLs.

## Custom Base Widgets

Use `defineWidgetBase` when multiple widgets share browser behavior or shared visual structure.

```ts
import { defineWidget, defineWidgetBase, scriptAsset, styleAsset } from "./widget-definition.ts";

const activityPanelBase = defineWidgetBase({
  assets: [
    styleAsset("/app-ui/activity-panel-base-v1.css", "body { margin: 0; }"),
    scriptAsset("/app-ui/activity-panel-base-v1.js", "globalThis.activityPanel = {};"),
  ],
  widget: {
    prefersBorder: true,
    csp: {
      connectDomains: ["https://api.example.com"],
      resourceDomains: [],
    },
  },
});

export const activitySummaryWidget = defineWidget({
  base: activityPanelBase,
  resourceUri: "ui://widget/activity-summary-v1.html",
  name: "activity-summary",
  title: "Activity Summary",
  description: "Renderable UI resource for activity summary.",
  markup: "<main id=\"root\"></main>",
  assets: [
    styleAsset("/app-ui/activity-summary-v1.css", "#root { min-height: 100vh; }"),
    scriptAsset("/app-ui/activity-summary-v1.js", "globalThis.activitySummary = {};"),
  ],
  widget: {
    description: "Shows activity summary data.",
  },
});
```

The registry de-duplicates inherited assets by path. A duplicate path with different content fails at startup.

## MCP And Actions Sharing

Keep capability behavior protocol-neutral. The shared capability module builds the data. MCP data tools, MCP render tools, and Actions endpoints call that module.

| Surface | Role |
| --- | --- |
| Shared module | Owns data loading, validation, and response shaping. |
| MCP data tool | Returns model-readable structured data. |
| MCP render tool | Returns the same `structuredContent` for the widget. |
| Widget | Reads `structuredContent` through `mcpWidget` or custom JavaScript. |
| Actions endpoint | Returns OpenAPI-compatible JSON from the same shared module. |

Widgets present tool output and call approved tool or HTTP surfaces when interaction is required.

For component-initiated tool calls, set `visibility: ["app"]` or `["model", "app"]` through `toolUiResource`. Set `widgetAccessible: true` when ChatGPT needs the OpenAI component-call alias. Protected interactive tools keep their own `requiredScopes`, input schema, output schema, authorization checks, and audit behavior.

For direct browser fetch calls from a component, add the target origin to `widget.csp.connectDomains`. The endpoint must enforce its own authentication and authorization. Keep secrets out of HTML, metadata, JavaScript assets, and browser storage.

## Tool Descriptor Metadata

`toolUiResource` adds descriptor metadata used by ChatGPT:

| Metadata | Value |
| --- | --- |
| `_meta.ui.resourceUri` | Resource URI passed to ChatGPT and MCP Apps clients. |
| `_meta.ui.visibility` | Tool availability for the model and component iframe. |
| `_meta["openai/outputTemplate"]` | ChatGPT alias for the same resource URI. |
| `_meta["openai/widgetAccessible"]` | ChatGPT alias that allows component-initiated tool calls when enabled. |

The default UI visibility for render tools is `["model", "app"]`. Data tools keep `["model"]`.

## Resource Metadata

`appHtmlResource` adds standard MCP Apps metadata and ChatGPT aliases:

| Metadata | Purpose |
| --- | --- |
| `_meta.ui.prefersBorder` | Card border hint for the host UI. |
| `_meta.ui.csp.connectDomains` | Network origins the component may contact. |
| `_meta.ui.csp.resourceDomains` | Static asset origins the component may load. |
| `_meta.ui.csp.frameDomains` | Subframe origins the component may embed. |
| `_meta.ui.domain` | Dedicated component origin for app submission. |
| `_meta["openai/widgetDescription"]` | ChatGPT component summary. |
| `_meta["openai/widgetPrefersBorder"]` | ChatGPT border hint alias. |
| `_meta["openai/widgetCSP"]` | ChatGPT CSP alias with snake case fields. |
| `_meta["openai/widgetDomain"]` | ChatGPT component origin alias. |

## CSP Rules

Declare every external origin the component uses.

| CSP field | Use |
| --- | --- |
| `connectDomains` | Fetch, XHR, WebSocket, and other network calls from the component. |
| `resourceDomains` | Scripts, styles, images, fonts, and other static assets. |
| `frameDomains` | Subframe origins embedded by the component. |
| `redirectDomains` | Trusted `window.openai.openExternal` destinations in ChatGPT. |

`redirectDomains` appears in `_meta["openai/widgetCSP"].redirect_domains`. The standard `_meta.ui.csp` surface carries `connectDomains`, `resourceDomains`, and `frameDomains`.

The runtime adds `WIDGET_DOMAIN` to the resource-domain metadata. Widget modules declare additional origins.

## Asset Rules

Widget assets are public read-only files served from exact versioned paths. Use `/app-ui/name-v1.js` for JavaScript and `/app-ui/name-v1.css` for CSS. Register every asset route explicitly in `mcp/endpoints.widget-assets.ts`.

Keep executable widget behavior in `scriptAsset` entries. Keep visual rules in `styleAsset` entries. `defineWidget` adds asset tags to the HTML template and returns a resource definition for the MCP registry.

Change the resource URI and asset path version when a template, asset, or data contract changes in a breaking way.

## Security Rules

Treat HTML, JavaScript, CSS, metadata, domains, and resource URIs as security-sensitive service outputs.

| Area | Rule |
| --- | --- |
| URI | Use `ui`, `https`, or `http` schemes accepted by the service. |
| Versioning | Change the resource URI for breaking template updates. |
| Scopes | Set `requiredScopes` for resources that render protected user data. |
| Tool auth | Use the same scopes on render tools that read or return protected data. |
| Interaction auth | Enforce scopes on every component-callable tool and direct endpoint. |
| CSP | Declare every network, asset, frame, and redirect origin the component needs. |
| Domain | Use an origin with no path, query, fragment, username, or password. |
| Widget origin | Use a unique origin for each submitted ChatGPT app. |
| Inline code | Keep JavaScript and CSS in versioned widget assets. |
| Secrets | Keep tokens, session IDs, cookies, client secrets, and private user data out of HTML and metadata. |
| Output | Return protected data through authorized tool `structuredContent` and component-only metadata. |

## Testing

Add live MCP tests for every UI resource feature:

- `initialize` advertises the `resources` capability.
- `tools/list` exposes `_meta.ui.resourceUri` and `_meta["openai/outputTemplate"]`.
- Interactive descriptors expose `_meta["openai/widgetAccessible"]` when enabled.
- `resources/list` exposes descriptors with `text/html;profile=mcp-app`.
- `resources/read` returns HTML content with UI metadata.
- UI HTML references inherited and widget-specific CSS and JavaScript assets.
- Widget asset endpoints return public CSS and JavaScript with safe response headers.
- Protected resources return scope challenges for missing scopes.
- Render tools return schema-valid `structuredContent`.
- Widget framework tests prove base inheritance, CSP merging, asset conflict detection, and declarative validation.
- Invalid resource URIs, cursors, metadata, MIME types, content shapes, asset paths, and widget declarations fail safely.

Run the focused test command while developing:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/app-ui-resources.test.ts test/mcp/widget-framework.test.ts test/mcp/protected-tools.test.ts
```

## Manual ChatGPT Verification

The automated harness proves service-side protocol behavior. ChatGPT iframe rendering runs on the ChatGPT side and needs manual verification.

Manual verification should confirm:

- ChatGPT completes account linking.
- ChatGPT refreshes the MCP tool list.
- Render tools appear with clear names and descriptions.
- A render tool call mounts the inline component.
- Protected render tools request authorization when scopes are missing.
- Component interactions call tools available through `_meta.ui.visibility`.
- Browser developer tools show expected CSP and sandbox behavior.

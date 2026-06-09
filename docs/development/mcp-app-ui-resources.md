# MCP Apps UI Resources

Use this guide when an MCP tool needs a ChatGPT-rendered HTML and JavaScript component.

## Runtime Ownership

| Runtime area | Owning files |
| --- | --- |
| UI resource types | `mcp/resource-types.ts` |
| UI resource builders | `mcp/app-ui.ts` |
| Resource validation | `mcp/resource-validation.ts` |
| Resource registry | `mcp/resource-registry.ts` |
| Widget definitions | `mcp/widgets/` |
| Widget asset routes | `mcp/endpoints.widget-assets.ts` |
| Render tools | `mcp/tools/` |
| Protocol dispatch | `mcp/protocol.ts` |

## Resource Contract

Every UI resource has a stable URI, MIME type, HTML content, metadata, and optional scopes. The UI MIME type is `text/html;profile=mcp-app`. The URI is the cache key used by ChatGPT. Change the URI when the HTML, JavaScript, CSS, or data contract changes in a breaking way.

Use `ui://widget/name-v1.html` for service-hosted component templates. Use an `https://` URI for resources fetched directly by the client from that origin.

The service applies the configured widget origin to every MCP Apps HTML resource during `resources/read`. The origin appears as `_meta.ui.domain` and `_meta["openai/widgetDomain"]`.

HTML templates load JavaScript and CSS through versioned `/app-ui/` asset paths. The service adds the configured widget origin to `_meta.ui.csp.resourceDomains` and `_meta["openai/widgetCSP"].resource_domains` during `resources/read`. ChatGPT can then enforce CSP and load first-party assets from the widget origin.

Each widget module owns its resource URI, markup, assets, metadata, scopes, and exported widget definition. `mcp/widgets/index.ts` collects widget resources and widget assets for the MCP registry and asset endpoint helpers.

## Developer Flow

1. Create a widget module under `mcp/widgets/`.
2. Export a versioned URI constant and versioned asset path constants.
3. Build the widget with `defineWidget`.
4. Put markup, JavaScript, CSS, metadata, CSP needs, border preference, and scopes in that widget module.
5. Register the widget in `mcp/widgets/index.ts`.
6. Expose each asset through an exact public route in `mcp/endpoints.widget-assets.ts`.
7. Create a render tool under `mcp/tools/`.
8. Attach the widget URI with `toolUiResource`.
9. Register the tool in `mcp/tool-registry.ts`.
10. Add live MCP tests under `test/mcp/`.
11. Update MCP API docs, GPT Apps setup docs, capability docs, and security docs.

## Minimal Resource

```ts
import { defineWidget, scriptAsset, styleAsset } from "./widget-definition.ts";

export const accountPanelUri = "ui://widget/account-panel-v1.html";
export const accountPanelStylePath = "/app-ui/account-panel-v1.css";
export const accountPanelScriptPath = "/app-ui/account-panel-v1.js";

export const accountPanelWidget = defineWidget({
  resourceUri: accountPanelUri,
  name: "account-panel",
  title: "Account Panel",
  description: "Renderable UI resource for account details.",
  markup: "<main id=\"root\"></main>",
  assets: [
    styleAsset(accountPanelStylePath, "body { margin: 0; }"),
    scriptAsset(accountPanelScriptPath, "console.log('account panel ready');"),
  ],
  requiredScopes: ["openid", "profile", "email"],
  widget: {
    description: "Shows account details returned by the service.",
    prefersBorder: true,
    csp: {
      connectDomains: ["https://api.example.com"],
      resourceDomains: [],
    },
  },
});
```

Register the widget in `mcp/widgets/index.ts`. Add exact asset routes in `mcp/endpoints.widget-assets.ts` because Encore requires literal endpoint paths during service graph analysis.

## Minimal Render Tool

```ts
import { toolUiResource } from "../app-ui.ts";
import { accountPanelUri } from "../widgets/account-panel.ts";

export const accountPanelTool = {
  name: "account.panel",
  title: "Account Panel",
  description: "Use this when ChatGPT should render account details as an inline UI panel.",
  ui: toolUiResource(accountPanelUri),
};
```

The actual tool must also define schemas, annotations, invocation text, scopes, and a `run` handler through `McpTool`.

## Shared Capability Pattern

Use shared modules for capability data that appears through both MCP and Actions surfaces. Place protocol-neutral data builders under `shared/` or an existing domain folder. Let MCP tools, MCP render tools, and Actions endpoints call the same builder.

For a widget-backed capability, keep these pieces separate:

| Piece | Owner |
| --- | --- |
| Capability data | `shared/` or the domain module that owns the data. |
| MCP data tool | `mcp/tools/` |
| MCP render tool | `mcp/tools/` |
| Widget template and assets | `mcp/widgets/` |
| Actions endpoint | `actions/` |

The render tool returns the same schema-valid `structuredContent` that the widget reads through `window.openai.toolOutput` and `ui/notifications/tool-result`. The Actions endpoint returns the protocol shape needed by GPT Actions while using the same underlying capability data.

## Tool Descriptor Metadata

`toolUiResource` adds the service-side descriptor metadata that ChatGPT needs:

| Metadata | Value |
| --- | --- |
| `_meta.ui.resourceUri` | Resource URI passed to ChatGPT and MCP Apps clients. |
| `_meta.ui.visibility` | Tool visibility for the model and component iframe. |
| `_meta["openai/outputTemplate"]` | ChatGPT compatibility alias for the same resource URI. |

The default UI visibility for render tools is `["model", "app"]`. Existing data tools keep `["model"]`.

## Resource Metadata

`appHtmlResource` adds standard MCP Apps metadata and ChatGPT compatibility aliases:

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

## Extension Points

Developers can extend the resource and descriptor metadata through these fields:

| Field | Use |
| --- | --- |
| `widget` on `defineWidget` | Add resource content metadata, border preference, and CSP values. |
| `widget.ui` on `defineWidget` | Add future standard `_meta.ui` fields. |
| `meta` on `toolUiResource` | Add tool descriptor `_meta` fields. |
| `visibility` on `toolUiResource` | Restrict calls to the model, the component iframe, or both. |
| `openAiOutputTemplate` on `toolUiResource` | Set a separate ChatGPT template URI or disable the alias with `false`. |
| `requiredScopes` on `defineWidget` | Require scopes before `resources/read` returns content. |

## Asset Rules

Widget assets are public read-only files served from exact versioned paths. Use `/app-ui/name-v1.js` for JavaScript and `/app-ui/name-v1.css` for CSS. Register every asset route explicitly in `mcp/endpoints.widget-assets.ts`.

Keep executable widget behavior in `scriptAsset` entries. Keep visual rules in `styleAsset` entries. `defineWidget` adds asset tags to the HTML template and returns a resource definition for the MCP registry.

Use the configured widget origin as the asset origin. CDK sets the widget origin through `WIDGET_DOMAIN`, and `resources/read` mirrors that origin into the resource CSP metadata.

Change the resource URI and asset path version when a template, asset, or data contract changes in a breaking way.

## Security Rules

Treat HTML, JavaScript, CSS, metadata, domains, and resource URIs as security-sensitive service outputs.

| Area | Rule |
| --- | --- |
| URI | Use `ui`, `https`, or `http` schemes accepted by the service. |
| Versioning | Change the resource URI for breaking template updates. |
| Scopes | Set `requiredScopes` for resources that render protected user data. |
| Tool auth | Use the same scopes on the render tool that reads or returns protected data. |
| CSP | Declare every network, asset, and frame origin the component needs. |
| Domain | Use an origin with no path, query, fragment, username, or password. |
| Widget origin | Use a unique origin for each submitted ChatGPT app. |
| Inline code | Keep JavaScript and CSS in versioned widget assets. |
| Secrets | Keep tokens, session IDs, cookies, client secrets, and private user data out of HTML and metadata. |
| Output | Return protected data through `structuredContent` and component-only `_meta` after the tool is authorized. |

## Testing

Add live MCP tests for every UI resource feature:

- `initialize` advertises the `resources` capability.
- `tools/list` exposes `_meta.ui.resourceUri` and `_meta["openai/outputTemplate"]`.
- `resources/list` exposes descriptors with `text/html;profile=mcp-app`.
- `resources/read` returns HTML content with UI metadata.
- UI HTML references versioned CSS and JavaScript assets.
- Widget asset endpoints return public CSS and JavaScript with safe response headers.
- Protected resources return scope challenges for missing scopes.
- Render tools return schema-valid `structuredContent`.
- Invalid resource URIs, cursors, metadata, MIME types, and content shapes fail safely.

Run the focused test command while developing:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/app-ui-resources.test.ts test/mcp/protected-tools.test.ts
```

## Manual ChatGPT Verification

The automated harness proves service-side protocol behavior. ChatGPT iframe rendering runs on the ChatGPT side and needs manual verification.

Manual verification should confirm:

- ChatGPT completes account linking.
- ChatGPT refreshes the MCP tool list.
- Render tools appear with clear names and descriptions.
- A render tool call mounts the inline component.
- Protected render tools request authorization when scopes are missing.
- Component interactions call only tools available through `_meta.ui.visibility`.
- Browser developer tools show the expected CSP and sandbox behavior.

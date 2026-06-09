# MCP Apps UI Resources

Use this guide when an MCP tool needs a ChatGPT-rendered HTML and JavaScript component.

## Runtime Ownership

| Runtime area | Owning files |
| --- | --- |
| UI resource types | `mcp/resource-types.ts` |
| UI resource builders | `mcp/app-ui.ts` |
| Resource validation | `mcp/resource-validation.ts` |
| Resource registry | `mcp/resource-registry.ts` |
| Resource content modules | `mcp/resources/` |
| Render tools | `mcp/tools/` |
| Protocol dispatch | `mcp/protocol.ts` |

## Resource Contract

Every UI resource has a stable URI, MIME type, HTML content, metadata, and optional scopes. The UI MIME type is `text/html;profile=mcp-app`. The URI is the cache key used by ChatGPT. Change the URI when the HTML, JavaScript, CSS, or data contract changes in a breaking way.

Use `ui://widget/name-v1.html` for service-hosted component templates. Use an `https://` URI for resources fetched directly by the client from that origin.

The service applies the configured widget origin to every MCP Apps HTML resource during `resources/read`. The origin appears as `_meta.ui.domain` and `_meta["openai/widgetDomain"]`.

## Developer Flow

1. Create a resource module under `mcp/resources/`.
2. Export a versioned URI constant.
3. Build the resource with `appHtmlResource`.
4. Set widget metadata, CSP domains, domain, border preference, and scopes.
5. Register the resource in `mcp/resource-registry.ts`.
6. Create a render tool under `mcp/tools/`.
7. Attach the resource with `toolUiResource`.
8. Register the tool in `mcp/tool-registry.ts`.
9. Add live MCP tests under `test/mcp/`.
10. Update MCP API docs, GPT Apps setup docs, capability docs, and security docs.

## Minimal Resource

```ts
import { appHtmlResource } from "../app-ui.ts";

export const accountPanelUri = "ui://widget/account-panel-v1.html";

export const accountPanelResource = appHtmlResource({
  uri: accountPanelUri,
  name: "account-panel",
  title: "Account Panel",
  description: "Renderable UI resource for account details.",
  html: "<html><body><main id=\"root\"></main></body></html>",
  requiredScopes: ["openid", "profile", "email"],
  widget: {
    description: "Shows account details returned by the service.",
    prefersBorder: true,
    domain: "https://app.example.com",
    csp: {
      connectDomains: ["https://api.example.com"],
      resourceDomains: ["https://static.example.com"],
    },
  },
});
```

## Minimal Render Tool

```ts
import { toolUiResource } from "../app-ui.ts";
import { accountPanelUri } from "../resources/account-panel.ts";

export const accountPanelTool = {
  name: "account.panel",
  title: "Account Panel",
  description: "Use this when ChatGPT should render account details as an inline UI panel.",
  ui: toolUiResource(accountPanelUri),
};
```

The actual tool must also define schemas, annotations, invocation text, scopes, and a `run` handler through `McpTool`.

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
| `meta` on `appHtmlResource` | Add resource content `_meta` fields for new MCP Apps or ChatGPT metadata. |
| `widget.ui` on `appHtmlResource` | Add future standard `_meta.ui` fields. |
| `meta` on `toolUiResource` | Add tool descriptor `_meta` fields. |
| `visibility` on `toolUiResource` | Restrict calls to the model, the component iframe, or both. |
| `openAiOutputTemplate` on `toolUiResource` | Set a separate ChatGPT template URI or disable the alias with `false`. |
| `requiredScopes` on `appHtmlResource` | Require scopes before `resources/read` returns content. |

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
| Secrets | Keep tokens, session IDs, cookies, client secrets, and private user data out of HTML and metadata. |
| Output | Return protected data through `structuredContent` and component-only `_meta` after the tool is authorized. |

## Testing

Add live MCP tests for every UI resource feature:

- `initialize` advertises the `resources` capability.
- `tools/list` exposes `_meta.ui.resourceUri` and `_meta["openai/outputTemplate"]`.
- `resources/list` exposes descriptors with `text/html;profile=mcp-app`.
- `resources/read` returns HTML content with UI metadata.
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

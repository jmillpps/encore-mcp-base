# Client Metadata Maintenance

URL-shaped OAuth client IDs are resolved as Client ID Metadata Documents. This path treats remote metadata as untrusted input.

## Production Network Rules

Production metadata retrieval requires:

- HTTPS client ID URLs.
- Public hostnames.
- No credentials, query strings, or fragments.
- A path component.
- DNS resolution that avoids private, loopback, and special-use targets.
- Pinned lookup for the outbound request.
- No redirects.
- Short request timeout.
- Bounded response size.

## Metadata Rules

Metadata documents must decode as valid UTF-8 and parse as JSON.

Required metadata fields:

| Field | Rule |
| --- | --- |
| `client_id` | Must exactly match the document URL. |
| `client_name` | Must be a safe display name. |
| `redirect_uris` | Must be non-empty and valid for the environment. |

Supported token auth methods are `none` and `private_key_jwt`.

## ChatGPT Client Metadata

During GPT Apps setup, ChatGPT can provide:

| ChatGPT field | Service use |
| --- | --- |
| Client Identifier Metadata Document URL | OAuth `client_id` value for metadata-document clients. |
| Callback URL | Redirect URI that must appear in the resolved metadata or static client record. |

The service supports metadata-document client resolution. Dynamic Client Registration requires a registration endpoint.

Keep the Registration URL field empty when ChatGPT has no registration URL value. Use the Client Identifier Metadata Document URL as the client identifier when configuring a metadata-document client flow.

## Locale Hints

ChatGPT can send locale hints such as `ui_locales` during authorization. The service accepts these hints and keeps authorization policy tied to client ID, redirect URI, resource, scope, state, nonce, and PKCE values.

## Private Key JWT

Metadata-document clients using `private_key_jwt` must publish a same-origin `jwks_uri`. JWKS keys must be RSA `RS256` keys with at least 2048-bit modulus length.

Client assertions require valid signatures, accepted audience, current time bounds, and `jti` replay protection.

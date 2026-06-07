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

## Private Key JWT

Metadata-document clients using `private_key_jwt` must publish a same-origin `jwks_uri`. JWKS keys must be RSA `RS256` keys with at least 2048-bit modulus length.

Client assertions require valid signatures, accepted audience, current time bounds, and `jti` replay protection.

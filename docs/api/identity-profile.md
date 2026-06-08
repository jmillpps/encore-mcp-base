# Identity Profile

Identity claims come from upstream OIDC userinfo during OAuth login. The service binds the verified profile to the authorization grant and reuses that profile across OAuth, MCP, and Actions responses.

## Profile Fields

| Claim | Required upstream input | Normalized output rule |
| --- | --- | --- |
| `sub` | Yes. | Required stable subject from the upstream provider. |
| `email` | Yes. | Required valid email address. |
| `email_verified` | Yes. | Required verification value. Boolean input is accepted. String values `true` and `false` are normalized to booleans. |
| `given_name` | No. | Uses upstream value when present. Defaults to `Authenticated`. |
| `family_name` | No. | Uses upstream value when present. Defaults to `User`. |
| `name` | No. | Uses upstream value when present. Defaults to the normalized given and family names joined with a space. |
| `preferred_username` | No. | Uses upstream value when present. Defaults to the normalized email address. |

String values must be at most 256 characters and must omit line breaks.

## Claim Lifecycle

| Step | Behavior |
| --- | --- |
| Upstream login | The upstream IdP returns userinfo to the service after `/oauth/callback` exchanges the upstream authorization code. |
| Normalization | The service validates required fields, trims string fields, fills deterministic display defaults, and stores the normalized profile with the service authorization code or refresh token state. |
| Token issuance | Access tokens and ID tokens receive profile claims from the normalized profile. |
| Runtime responses | Userinfo, MCP tools, and Actions endpoints return profile data derived from token claims. |

## Surfaces

The same profile is returned through:

- OIDC ID token profile claims.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- Actions `GET /actions/profile`.

Additional profile attributes should be deterministic, stable, and tied to protocol compatibility.

## Compatibility Rules

| Rule | Reason |
| --- | --- |
| Keep `sub` stable for the upstream user. | Tokens, userinfo, Actions session metadata, and MCP session metadata use it as the subject identity. |
| Keep `email_verified` meaningful. | The current profile surface presents email as verified identity data. |
| Keep generated defaults deterministic. | Repeated logins for the same upstream profile should produce the same visible profile fields. |
| Add fields across every surface together. | ID tokens, userinfo, MCP output schemas, Actions response schemas, and OpenAPI schemas must stay aligned. |

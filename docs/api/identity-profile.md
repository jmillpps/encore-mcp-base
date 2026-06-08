# Identity Profile

Identity claims come from upstream OIDC userinfo during OAuth login. The service binds the verified profile to the authorization grant and reuses that profile across OAuth, MCP, and Actions responses.

## Profile Fields

| Claim | Rule |
| --- | --- |
| `sub` | Required stable subject from the upstream provider. |
| `email` | Required email address. |
| `email_verified` | Required boolean email verification claim. |
| `given_name` | Optional given name. |
| `family_name` | Optional family name. |
| `name` | Optional display name. Derived from available name parts when omitted. |
| `preferred_username` | Optional username. Derived from email local part when omitted. |

String values must be at most 256 characters and must omit line breaks.

## Surfaces

The same profile is returned through:

- OIDC ID token profile claims.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- Actions `GET /actions/profile`.

Additional profile attributes should be deterministic, stable, and tied to protocol compatibility.

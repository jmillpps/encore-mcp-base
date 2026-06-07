# Identity Profile

The current service identity is a configured static OpenID Connect user. Production deployments supply the identity through environment variables or the deployment secret store.

## Profile Fields

| Claim | Value |
| --- | --- |
| `sub` | `user_example` |
| `given_name` | `Example` |
| `family_name` | `User` |
| `name` | `Example User` |
| `preferred_username` | `example.user` |
| `email` | `user@example.test` |
| `email_verified` | `true` |

These values are local examples. Production values come from `STATIC_USER_*` configuration.

## Surfaces

The same profile is returned through:

- OIDC ID token profile claims.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- Actions `GET /actions/profile`.

Additional profile attributes should be deterministic, stable, and tied to protocol compatibility.

# Identity Profile

The current service identity is a static OpenID Connect user. This keeps OAuth, MCP, and Actions behavior deterministic while the future external identity provider remains out of scope.

## Profile Fields

| Claim | Value |
| --- | --- |
| `sub` | `user_justin_miller` |
| `given_name` | `Justin` |
| `family_name` | `Miller` |
| `name` | `Justin Miller` |
| `preferred_username` | `jmiller` |
| `email` | `jmiller@inifnitedevlab.com` |
| `email_verified` | `true` |

## Surfaces

The same profile is returned through:

- OIDC ID token profile claims.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- Actions `GET /actions/profile`.

Additional profile attributes should be deterministic, stable, and tied to protocol compatibility.

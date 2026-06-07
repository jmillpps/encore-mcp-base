# Identity Profile

Production identity claims come from Cognito userinfo during OAuth login. Local development uses a configured profile for deterministic OAuth, MCP, and Actions behavior.

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

These values are local examples. Cognito-enabled production returns claims from the authenticated Cognito user.

## Surfaces

The same profile is returned through:

- OIDC ID token profile claims.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- Actions `GET /actions/profile`.

Additional profile attributes should be deterministic, stable, and tied to protocol compatibility.

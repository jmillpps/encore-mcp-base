# Deployment

Production deployment requires an explicit public issuer URL, MCP resource URL, Actions audience URL, OAuth store path, client registry, allowed origins, and signing key material.

The local development profile may generate signing keys and use local test clients.

Production startup must fail when required security configuration is missing.

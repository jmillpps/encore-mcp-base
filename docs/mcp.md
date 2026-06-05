# MCP

The service exposes MCP for GPT Apps through Streamable HTTP and SSE.

The first tool set includes a public health tool, a protected identity profile tool, and a protected auth session tool.

Protected tools validate issuer, audience, expiry, client ID, and scopes on every call.

When a protected tool needs authentication, it returns a ChatGPT-compatible `mcp/www_authenticate` challenge.

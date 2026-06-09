# Reference

This section maps project documentation to authoritative external specifications and official service documentation.

## Reference Pages

| Page | Purpose |
| --- | --- |
| [External References](external-references.md) | Lists the official sources used for MCP, ChatGPT Apps, GPT Actions, OAuth, OIDC, OpenAPI, JSON Schema, Encore, AWS, and Caddy guidance. |

## Maintenance Rules

- Use official sources for protocol and platform behavior.
- Prefer current specification URLs for MCP and service documentation.
- Keep examples generic.
- Review source relevance when protocol behavior, endpoint behavior, deployment behavior, or ChatGPT UI behavior changes.

## Reference Use

| When the document changes | Reference requirement |
| --- | --- |
| MCP transport, lifecycle, authorization, tools, or resources | Check the latest MCP specification and the matching versioned source. |
| ChatGPT Apps setup, auth, or UI resources | Check official OpenAI Apps SDK and ChatGPT developer documentation. |
| GPT Actions setup or schema behavior | Check official OpenAI Actions documentation and OpenAPI 3.1. |
| OAuth or OIDC behavior | Check the relevant RFC or OpenID Connect specification. |
| AWS deployment behavior | Check AWS CDK, Systems Manager Parameter Store, KMS, EC2, ECR, CodeBuild, and Route53 documentation. |
| Reverse proxy behavior | Check Caddy documentation for HTTPS and streaming behavior. |

## Review Output

Every source-backed update should leave three things clear: the official source, the local document that applies it, and the current implementation file or operator command that proves the project behavior.

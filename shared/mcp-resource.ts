export const mcpEndpointPath = "/mcp";

export function assertMcpResourceUrl(resource: string, key: string): void {
  const url = new URL(resource);
  if (url.pathname !== mcpEndpointPath) throw new Error(`${key} must end with ${mcpEndpointPath}`);
}

export function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname === "/" ? "" : url.pathname}`;
}

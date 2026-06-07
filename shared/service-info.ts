export const serviceName = "gpt-mcp-service";
export const serviceTitle = "GPT MCP Service";
export const serviceVersion = "0.1.0";
export const serviceDescription = "OAuth-backed MCP service for ChatGPT Apps and Actions.";
export const serviceIcon = {
  src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMwZjE3MmEiLz48cGF0aCBkPSJNMTggMzJjMC03LjczMiA2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNGMwIDcuNzMyLTYuMjY4IDE0LTE0IDE0cy0xNC02LjI2OC0xNC0xNHoiIGZpbGw9IiM1ZWU3YjciLz48cGF0aCBkPSJNMzIgMjR2MTZtLTgtOGgxNiIgc3Ryb2tlPSIjMGYxNzJhIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==",
  mimeType: "image/svg+xml",
  sizes: ["any"],
} as const;

export function serverImplementationInfo(websiteUrl: string): Record<string, unknown> {
  return {
    name: serviceName,
    title: serviceTitle,
    version: serviceVersion,
    description: serviceDescription,
    icons: [serviceIcon],
    websiteUrl,
  };
}

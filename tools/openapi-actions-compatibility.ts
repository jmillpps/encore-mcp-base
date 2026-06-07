type JsonObject = Record<string, unknown>;

const operationDescriptionLimit = 300;
const parameterDescriptionLimit = 700;
const methods = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);

export function assertChatGptActionsOpenApi(document: JsonObject): void {
  if (document.openapi !== "3.1.0") throw new Error("OpenAPI document must use version 3.1.0");
  const serverOrigin = readServerOrigin(document);
  assertOAuthOrigin(document, serverOrigin);
  for (const operation of operations(document)) {
    assertTextLimit(operation.operation.summary, operationDescriptionLimit, `${operation.name} summary`);
    assertTextLimit(operation.operation.description, operationDescriptionLimit, `${operation.name} description`);
    if (typeof operation.operation["x-openai-isConsequential"] !== "boolean") {
      throw new Error(`${operation.name} must set x-openai-isConsequential`);
    }
    assertParameters(operation);
    assertJsonContent(operation);
  }
}

interface Operation {
  name: string;
  operation: JsonObject;
}

function readServerOrigin(document: JsonObject): string {
  const servers = array(document.servers, "servers");
  const first = object(servers[0], "servers[0]");
  return new URL(text(first.url, "servers[0].url")).origin;
}

function assertOAuthOrigin(document: JsonObject, serverOrigin: string): void {
  const components = object(document.components, "components");
  const securitySchemes = object(components.securitySchemes, "components.securitySchemes");
  const oauth2 = object(securitySchemes.OAuth2, "components.securitySchemes.OAuth2");
  const flows = object(oauth2.flows, "components.securitySchemes.OAuth2.flows");
  const authorizationCode = object(flows.authorizationCode, "components.securitySchemes.OAuth2.flows.authorizationCode");
  for (const key of ["authorizationUrl", "tokenUrl"]) {
    const origin = new URL(text(authorizationCode[key], `OAuth2 ${key}`)).origin;
    if (origin !== serverOrigin) throw new Error(`OAuth2 ${key} must share the server origin`);
  }
}

function operations(document: JsonObject): Operation[] {
  const paths = object(document.paths, "paths");
  const found: Operation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const item = object(pathItem, `paths.${path}`);
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      found.push({ name: `${method.toUpperCase()} ${path}`, operation: object(operation, `${method.toUpperCase()} ${path}`) });
    }
  }
  return found;
}

function assertParameters(operation: Operation): void {
  const parameters = operation.operation.parameters;
  if (parameters === undefined) return;
  for (const [index, parameterValue] of array(parameters, `${operation.name} parameters`).entries()) {
    const parameter = object(parameterValue, `${operation.name} parameters[${index}]`);
    if (parameter.in === "header") throw new Error(`${operation.name} must not require custom headers`);
    if (parameter.description !== undefined) {
      assertTextLimit(parameter.description, parameterDescriptionLimit, `${operation.name} parameter description`);
    }
  }
}

function assertJsonContent(operation: Operation): void {
  const requestBody = operation.operation.requestBody;
  if (requestBody !== undefined) assertContentTypes(object(requestBody, `${operation.name} requestBody`).content, `${operation.name} requestBody`);
  const responses = object(operation.operation.responses, `${operation.name} responses`);
  for (const [status, responseValue] of Object.entries(responses)) {
    const response = object(responseValue, `${operation.name} response ${status}`);
    if (response.content !== undefined) assertContentTypes(response.content, `${operation.name} response ${status}`);
  }
}

function assertContentTypes(contentValue: unknown, name: string): void {
  const content = object(contentValue, `${name} content`);
  for (const contentType of Object.keys(content)) {
    if (contentType !== "application/json") throw new Error(`${name} must use application/json content`);
  }
}

function assertTextLimit(value: unknown, limit: number, name: string): void {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is required`);
  if (value.length > limit) throw new Error(`${name} must be ${limit} characters or less`);
}

function object(value: unknown, name: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as JsonObject;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a string`);
  return value;
}

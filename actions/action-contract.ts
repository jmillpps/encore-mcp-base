type JsonObject = Record<string, unknown>;

export type ActionName = "health" | "profile" | "session";

export type ActionRoute = {
  name: ActionName;
  method: "GET";
  path: string;
  auth: boolean;
};

export type ActionOperationDefinition = {
  name: ActionName;
  operationId: string;
  summary: string;
  description: string;
  scopes: readonly string[];
  success: {
    description: string;
    schema: keyof typeof actionSchemas;
  };
};

export const actionOAuthScopes = {
  openid: "Identify the signed-in user.",
  profile: "Read the user profile.",
  email: "Read the user email address.",
} as const;

export const actionSchemas = {
  HealthResponse: objectSchema("Service reachability response for GPT Actions.", ["status", "time", "service"], {
    status: property("Fixed health status value returned when the service is reachable.", { type: "string", enum: ["ok"] }),
    time: property("Server time when the health response was produced.", { type: "string", format: "date-time" }),
    service: property("Service identifier that produced the health response.", { type: "string" }),
  }),
  UserProfile: objectSchema("OpenID Connect profile for the authenticated user.", ["sub", "given_name", "family_name", "name", "preferred_username", "email", "email_verified"], {
    sub: property("Stable subject identifier for the authenticated user.", { type: "string" }),
    given_name: property("Given name for the authenticated user.", { type: "string" }),
    family_name: property("Family name for the authenticated user.", { type: "string" }),
    name: property("Full display name for the authenticated user.", { type: "string" }),
    preferred_username: property("Preferred username for the authenticated user.", { type: "string" }),
    email: property("Verified email address for the authenticated user.", { type: "string", format: "email" }),
    email_verified: property("Email verification status for the authenticated user.", { type: "boolean" }),
  }),
  SessionResponse: objectSchema("OAuth token session metadata for the authenticated request.", ["subject", "clientId", "audience", "scopes"], {
    subject: property("Subject identifier bound to the access token.", { type: "string" }),
    clientId: property("OAuth client identifier bound to the access token.", { type: "string" }),
    audience: property("Audience value accepted for the access token.", { type: "string" }),
    scopes: property("OAuth scopes granted to the access token.", { type: "array", items: { type: "string", description: "Granted OAuth scope." } }),
  }),
  ErrorResponse: objectSchema("Standard Encore error response exposed to GPT Actions.", ["code", "message", "details", "internal_message"], {
    code: property("Stable error code returned by the service.", { type: "string" }),
    message: property("Safe error message returned to the caller.", { type: "string" }),
    details: property("Structured error details when available.", {}),
    internal_message: property("Nullable field retained for the live error contract.", { type: ["string", "null"] }),
  }),
} as const;

export const actionOperationDefinitions = [
  {
    name: "health",
    operationId: "getServiceHealth",
    summary: "Check service health",
    description: "Return service health status so ChatGPT can verify the service is reachable before protected calls.",
    scopes: [],
    success: { description: "Service health.", schema: "HealthResponse" },
  },
  {
    name: "profile",
    operationId: "getAuthenticatedProfile",
    summary: "Get authenticated profile",
    description: "Return the signed-in user's OpenID Connect profile fields for identity-aware GPT Actions.",
    scopes: ["openid", "profile", "email"],
    success: { description: "Authenticated user profile.", schema: "UserProfile" },
  },
  {
    name: "session",
    operationId: "getAuthenticatedSession",
    summary: "Get authenticated session",
    description: "Return OAuth token session metadata, including subject, client ID, audience, and granted scopes.",
    scopes: ["openid"],
    success: { description: "Authenticated session metadata.", schema: "SessionResponse" },
  },
] as const satisfies readonly ActionOperationDefinition[];

export const actionScopes = {
  health: operationDefinition("health").scopes,
  profile: operationDefinition("profile").scopes,
  session: operationDefinition("session").scopes,
} as const;

export function actionPaths(routes: readonly ActionRoute[]): JsonObject {
  const paths: JsonObject = {};
  for (const route of routes) {
    const definition = operationDefinition(route.name);
    assertRouteMatchesOperation(route, definition);
    paths[route.path] = { [route.method.toLowerCase()]: operation(definition) };
  }
  return paths;
}

export function actionComponents(baseUrl: string): JsonObject {
  return {
    securitySchemes: { OAuth2: oauthScheme(baseUrl) },
    schemas: cloneJsonObject(actionSchemas),
  };
}

export function assertActionRouteManifest(routes: readonly ActionRoute[]): void {
  const names = new Set<ActionName>();
  for (const route of routes) {
    if (names.has(route.name)) throw new Error(`duplicate Actions route ${route.name}`);
    names.add(route.name);
    assertRouteMatchesOperation(route, operationDefinition(route.name));
  }
  for (const definition of actionOperationDefinitions) {
    if (!names.has(definition.name)) throw new Error(`missing Actions route ${definition.name}`);
  }
}

function operationDefinition(name: ActionName): ActionOperationDefinition {
  const definition = actionOperationDefinitions.find((entry) => entry.name === name);
  if (!definition) throw new Error(`unknown Actions operation ${name}`);
  return definition;
}

function assertRouteMatchesOperation(route: ActionRoute, definition: ActionOperationDefinition): void {
  if (route.auth !== (definition.scopes.length > 0)) throw new Error(`Actions route auth mismatch for ${route.name}`);
}

function operation(definition: ActionOperationDefinition): JsonObject {
  const value: JsonObject = {
    operationId: definition.operationId,
    summary: definition.summary,
    description: definition.description,
    tags: ["Actions"],
    "x-openai-isConsequential": false,
    responses: {
      200: jsonResponse(definition.success.description, definition.success.schema),
    },
  };
  if (definition.scopes.length > 0) {
    value.security = [{ OAuth2: [...definition.scopes] }];
    value.responses = {
      ...(value.responses as JsonObject),
      401: jsonResponse("Invalid bearer token.", "ErrorResponse"),
      403: jsonResponse("Missing required scope.", "ErrorResponse"),
    };
  }
  return value;
}

function oauthScheme(baseUrl: string): JsonObject {
  return {
    type: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl: `${baseUrl}/oauth/authorize`,
        tokenUrl: `${baseUrl}/oauth/token`,
        scopes: { ...actionOAuthScopes },
      },
    },
  };
}

function jsonResponse(description: string, schema: keyof typeof actionSchemas): JsonObject {
  return {
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } },
  };
}

function objectSchema(description: string, required: string[], properties: JsonObject): JsonObject {
  return { type: "object", description, additionalProperties: false, required, properties };
}

function property(description: string, schema: JsonObject): JsonObject {
  return { ...schema, description };
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return structuredClone(value) as JsonObject;
}

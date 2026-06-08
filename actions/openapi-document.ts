type JsonObject = Record<string, unknown>;

export function openApiDocument(baseUrl: string): JsonObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "GPT MCP Service Actions API",
      description: "OAuth-protected profile and session actions for the GPT MCP Service.",
      version: "0.1.0",
    },
    servers: [{ url: baseUrl }],
    "x-generated-from": "encore-compiled-route-graph",
    paths: actionPaths(),
    components: {
      securitySchemes: { OAuth2: oauthScheme(baseUrl) },
      schemas: schemas(),
    },
  };
}

function actionPaths(): JsonObject {
  return {
    "/health": {
      get: {
        operationId: "getServiceHealth",
        summary: "Check service health",
        description: "Return service health status so ChatGPT can verify the service is reachable before protected calls.",
        tags: ["Actions"],
        "x-openai-isConsequential": false,
        responses: { 200: jsonResponse("Service health.", "HealthResponse") },
      },
    },
    "/actions/profile": {
      get: {
        operationId: "getAuthenticatedProfile",
        summary: "Get authenticated profile",
        description: "Return the signed-in user's OpenID Connect profile fields for identity-aware GPT Actions.",
        tags: ["Actions"],
        security: [{ OAuth2: ["openid", "profile", "email"] }],
        "x-openai-isConsequential": false,
        responses: {
          200: jsonResponse("Authenticated user profile.", "UserProfile"),
          401: jsonResponse("Invalid bearer token.", "ErrorResponse"),
          403: jsonResponse("Missing required scope.", "ErrorResponse"),
        },
      },
    },
    "/actions/session": {
      get: {
        operationId: "getAuthenticatedSession",
        summary: "Get authenticated session",
        description: "Return OAuth token session metadata, including subject, client ID, audience, and granted scopes.",
        tags: ["Actions"],
        security: [{ OAuth2: ["openid"] }],
        "x-openai-isConsequential": false,
        responses: {
          200: jsonResponse("Authenticated session metadata.", "SessionResponse"),
          401: jsonResponse("Invalid bearer token.", "ErrorResponse"),
          403: jsonResponse("Missing required scope.", "ErrorResponse"),
        },
      },
    },
  };
}

function oauthScheme(baseUrl: string): JsonObject {
  return {
    type: "oauth2",
    flows: {
      authorizationCode: {
        authorizationUrl: `${baseUrl}/oauth/authorize`,
        tokenUrl: `${baseUrl}/oauth/token`,
        scopes: {
          openid: "Identify the signed-in user.",
          profile: "Read the user profile.",
          email: "Read the user email address.",
        },
      },
    },
  };
}

function schemas(): JsonObject {
  return {
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
  };
}

function jsonResponse(description: string, schema: string): JsonObject {
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

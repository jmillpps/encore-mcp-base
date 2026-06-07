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
          200: jsonResponse("Static authenticated profile.", "StaticUser"),
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
    HealthResponse: objectSchema(["status", "time", "service"], {
      status: { type: "string", enum: ["ok"] },
      time: { type: "string", format: "date-time" },
      service: { type: "string" },
    }),
    StaticUser: objectSchema(["sub", "given_name", "family_name", "name", "preferred_username", "email", "email_verified"], {
      sub: { type: "string" },
      given_name: { type: "string" },
      family_name: { type: "string" },
      name: { type: "string" },
      preferred_username: { type: "string" },
      email: { type: "string", format: "email" },
      email_verified: { type: "boolean" },
    }),
    SessionResponse: objectSchema(["subject", "clientId", "audience", "scopes"], {
      subject: { type: "string" },
      clientId: { type: "string" },
      audience: { type: "string" },
      scopes: { type: "array", items: { type: "string" } },
    }),
    ErrorResponse: objectSchema(["code", "message", "details", "internal_message"], {
      code: { type: "string" },
      message: { type: "string" },
      details: {},
      internal_message: { type: ["string", "null"] },
    }),
  };
}

function jsonResponse(description: string, schema: string): JsonObject {
  return {
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } },
  };
}

function objectSchema(required: string[], properties: JsonObject): JsonObject {
  return { type: "object", additionalProperties: false, required, properties };
}

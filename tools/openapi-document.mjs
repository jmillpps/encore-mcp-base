export function openApiDocument(baseUrl) {
  return {
    openapi: "3.1.0",
    info: { title: "GPT MCP Service Actions API", version: "0.1.0" },
    servers: [{ url: baseUrl }],
    "x-generated-from": "encore-compiled-route-graph",
    paths: actionPaths(),
    components: {
      securitySchemes: { OAuth2: oauthScheme(baseUrl) },
      schemas: schemas(),
    },
  };
}

function actionPaths() {
  return {
    "/health": {
      get: {
        operationId: "health",
        tags: ["Actions"],
        responses: { 200: jsonResponse("Service health.", "HealthResponse") },
      },
    },
    "/actions/profile": {
      get: {
        operationId: "getActionProfile",
        tags: ["Actions"],
        security: [{ OAuth2: ["openid", "profile", "email"] }],
        responses: {
          200: jsonResponse("Static authenticated profile.", "StaticUser"),
          401: jsonResponse("Invalid bearer token.", "ErrorResponse"),
        },
      },
    },
    "/actions/session": {
      get: {
        operationId: "getActionSession",
        tags: ["Actions"],
        security: [{ OAuth2: ["openid"] }],
        responses: {
          200: jsonResponse("Authenticated session metadata.", "SessionResponse"),
          401: jsonResponse("Invalid bearer token.", "ErrorResponse"),
        },
      },
    },
  };
}

function oauthScheme(baseUrl) {
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

function schemas() {
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
    ErrorResponse: objectSchema(["code", "message"], {
      code: { type: "string" },
      message: { type: "string" },
      details: {},
    }),
  };
}

function jsonResponse(description, schema) {
  return {
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${schema}` } } },
  };
}

function objectSchema(required, properties) {
  return { type: "object", additionalProperties: false, required, properties };
}

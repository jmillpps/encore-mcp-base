import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeOAuthError } from "../../auth/oauth-errors.ts";
import { enforceRateLimit } from "../../auth/rate-limit.ts";
import { readConfig } from "../../shared/config.ts";
import { emitDiagnostic, redactFields, setDiagnosticSink, type DiagnosticEvent } from "../../shared/diagnostics.ts";
import { ServiceError } from "../../shared/errors.ts";
import { writeError } from "../../shared/http.ts";

test("diagnostic redaction removes credential values from nested fields", () => {
  const redacted = redactFields({
    Authorization: "Bearer access-token",
    client_secret: "client-secret",
    sessionId: "session-id",
    nested: {
      authorization_code: "authorization-code",
      refresh_token: "refresh-token",
      safe: "client-id",
    },
    headers: [
      { cookie: "session-cookie" },
      { "x-api-key": "api-key-value" },
    ],
  });
  const text = JSON.stringify(redacted);
  assert.equal(text.includes("Bearer access-token"), false);
  assert.equal(text.includes("client-secret"), false);
  assert.equal(text.includes("session-id"), false);
  assert.equal(text.includes("authorization-code"), false);
  assert.equal(text.includes("refresh-token"), false);
  assert.equal(text.includes("session-cookie"), false);
  assert.equal(text.includes("api-key-value"), false);
  assert.equal(text.includes("client-id"), true);
  assert.match(String(redacted.Authorization), /^\[redacted:/);
});

test("diagnostic redaction preserves nonsecret service fields", () => {
  const redacted = redactFields({
    code: "invalid_client",
    endpoint: "oauth.token",
    clientId: "local-test",
    status: 401,
  });
  assert.equal(redacted.code, "invalid_client");
  assert.equal(redacted.endpoint, "oauth.token");
  assert.equal(redacted.clientId, "local-test");
  assert.equal(redacted.status, 401);
});

test("writeError emits structured service diagnostics without secrets", () => {
  const events: DiagnosticEvent[] = [];
  const restore = setDiagnosticSink((event) => events.push(event));
  try {
    const response = fakeResponse();
    writeError(response, new ServiceError("invalid_client", "invalid client", 401), {
      endpoint: "oauth.token",
      method: "POST",
      subject: "127.0.0.1",
      fields: { clientId: "local-test", client_secret: "bad-secret", authorization: "Basic secret" },
    });
    assert.equal(response.status, 401);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, "service_error");
    assert.equal(events[0]?.level, "warn");
    assert.equal(events[0]?.fields.endpoint, "oauth.token");
    assert.equal(events[0]?.fields.code, "invalid_client");
    const serialized = JSON.stringify(events[0]);
    assert.equal(serialized.includes("bad-secret"), false);
    assert.equal(serialized.includes("Basic secret"), false);
    assert.equal(serialized.includes("local-test"), true);
  } finally {
    restore();
  }
});

test("writeOAuthError emits generic responses and structured diagnostics", () => {
  const events: DiagnosticEvent[] = [];
  const restore = setDiagnosticSink((event) => events.push(event));
  try {
    const response = fakeResponse();
    writeOAuthError(response, new ServiceError("bad_request", "redirect_uri is not registered", 400), {
      endpoint: "oauth.authorize",
      method: "GET",
      subject: "127.0.0.1",
      fields: { clientId: "local-test", client_secret: "bad-secret" },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(String(response.body)), { error: "bad_request", error_description: "invalid request" });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, "oauth_error");
    assert.equal(events[0]?.level, "warn");
    assert.equal(events[0]?.fields.endpoint, "oauth.authorize");
    assert.equal(events[0]?.fields.code, "bad_request");
    const serialized = JSON.stringify(events[0]);
    assert.equal(serialized.includes("redirect_uri is not registered"), false);
    assert.equal(serialized.includes("bad-secret"), false);
  } finally {
    restore();
  }
});

test("writeError emits unhandled diagnostics without internal messages", () => {
  const events: DiagnosticEvent[] = [];
  const restore = setDiagnosticSink((event) => events.push(event));
  try {
    const response = fakeResponse();
    writeError(response, new Error("database password leaked"), {
      endpoint: "mcp.post",
      method: "POST",
      subject: "127.0.0.1",
      fields: { access_token: "raw-token" },
    });
    assert.equal(response.status, 500);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, "unhandled_error");
    assert.equal(events[0]?.level, "error");
    const serialized = JSON.stringify(events[0]);
    assert.equal(serialized.includes("database password leaked"), false);
    assert.equal(serialized.includes("raw-token"), false);
  } finally {
    restore();
  }
});

test("diagnostic sink can be replaced and restored", () => {
  const events: DiagnosticEvent[] = [];
  const restore = setDiagnosticSink((event) => events.push(event));
  emitDiagnostic("warn", "service_error", { refresh_token: "refresh-token" });
  restore();
  assert.equal(events.length, 1);
  assert.equal(JSON.stringify(events[0]).includes("refresh-token"), false);
});

test("rate limit diagnostics expose bucket policy and hashed subject", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-rate-limit-diagnostics-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const config = readConfig({ OAUTH_STORE_PATH: join(dir, "store.json"), RATE_LIMIT_WINDOW_SECONDS: "60", RATE_LIMIT_MAX_REQUESTS: "1" });
  const events: DiagnosticEvent[] = [];
  const restore = setDiagnosticSink((event) => events.push(event));
  try {
    await enforceRateLimit(config, "oauth-token", "client-secret-value");
    await assert.rejects(() => enforceRateLimit(config, "oauth-token", "client-secret-value"), /rate limit exceeded/);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event, "rate_limit_exceeded");
    assert.equal(events[0]?.level, "warn");
    assert.equal(events[0]?.fields.bucket, "oauth-token");
    assert.equal(events[0]?.fields.windowSeconds, 60);
    assert.equal(events[0]?.fields.maxRequests, 1);
    assert.equal(typeof events[0]?.fields.subjectHash, "string");
    assert.equal(JSON.stringify(events[0]).includes("client-secret-value"), false);
  } finally {
    restore();
  }
});

function fakeResponse(): ServerResponse & { status?: number; body?: string } {
  const response: { status?: number; body?: string; writeHead(status: number): unknown; end(body?: string): unknown } = {
    writeHead(status: number) {
      response.status = status;
      return response;
    },
    end(body?: string) {
      response.body = body;
      return response;
    },
  };
  return response as ServerResponse & { status?: number; body?: string };
}

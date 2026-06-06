import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";
import { requireString } from "../support/http.ts";

const execFileAsync = promisify(execFile);

test("client secret generator emits registry-ready metadata", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["--experimental-strip-types", "tools/generate-client-secret.ts"]);
  const payload = JSON.parse(stdout) as Record<string, unknown>;
  const secret = requireString(payload.clientSecret, "clientSecret");
  const hash = requireString(payload.clientSecretHash, "clientSecretHash");
  const note = requireString(payload.operatorNote, "operatorNote");
  assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(createHash("sha256").update(secret, "utf8").digest("base64url"), hash);
  assert.equal("clientSecretSha256" in payload, false);
  assert.match(note, /OAUTH_CLIENTS_JSON/);
});

import { createHash, randomBytes } from "node:crypto";

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const secret = base64url(randomBytes(32));
const hash = createHash("sha256").update(secret, "utf8").digest("base64url");

console.log(
  JSON.stringify(
    {
      clientSecret: secret,
      clientSecretHash: hash,
      operatorNote: "Store clientSecret in the GPT OAuth configuration. Store clientSecretHash in OAUTH_CLIENTS_JSON. The raw clientSecret is shown once.",
    },
    null,
    2,
  ),
);

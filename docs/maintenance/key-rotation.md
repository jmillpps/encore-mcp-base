# Signing Key Rotation

The service signs access tokens and ID tokens with an active RSA key. JWKS publishes the active public key and configured previous public keys.

## Active Key Variables

| Variable | Purpose |
| --- | --- |
| `OAUTH_PRIVATE_KEY_PEM` | Active RSA private key. |
| `OAUTH_KEY_ID` | Active key ID used in JWT headers and JWKS. |

## Previous Keys

Use `OAUTH_PREVIOUS_PUBLIC_KEYS_JSON` to publish and verify old public keys during rotation.

Each previous key entry contains:

| Field | Purpose |
| --- | --- |
| `kid` | Previous key ID. |
| `publicKeyPem` | Previous RSA public key PEM. |

## Rotation Steps

1. Generate a new RSA key pair.
2. Move the current public key into `OAUTH_PREVIOUS_PUBLIC_KEYS_JSON`.
3. Set the new private key in `OAUTH_PRIVATE_KEY_PEM`.
4. Set the new key ID in `OAUTH_KEY_ID`.
5. Deploy the service.
6. Keep previous public keys until all tokens signed by those keys expire.
7. Remove expired previous keys.

The service rejects weak RSA keys, unsafe key IDs, duplicate key IDs, and missing production signing material.

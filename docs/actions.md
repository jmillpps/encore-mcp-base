# GPT Actions

GPT Actions use the REST endpoints exposed by Encore typed APIs.

Protected Actions endpoints require bearer access tokens issued by this service.

`/actions/profile` requires `openid profile email`.

`/actions/session` requires `openid`.

The OpenAPI export must describe the protected action endpoints and OAuth authorization code flow.

GPT Actions account linking uses the registered `gpt-actions` OAuth client.

The Actions OAuth client can omit `resource` during authorization, code exchange, and refresh.

The service binds omitted Actions resources to the configured Actions audience.

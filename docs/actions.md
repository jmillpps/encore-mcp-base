# GPT Actions

GPT Actions use the REST endpoints exposed by Encore typed APIs.

Protected Actions endpoints require bearer access tokens issued by this service.

`/actions/profile` requires `openid profile email`.

`/actions/session` requires `openid`.

The OpenAPI export must describe the protected action endpoints and OAuth authorization code flow.

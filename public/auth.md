# PropXchain auth.md — Agent Authorization

> Published at **https://propxchain.com/auth.md**. This file is a prose
> companion to the machine-readable metadata. The **Protected Resource
> Metadata (PRM)** is the authoritative source of truth — if anything here
> disagrees with the PRM, the PRM wins.

PropXchain lets AI agents act on a user's behalf through the Model Context
Protocol. Two hosts are involved:

- **Resource server:** `https://mcp.propxchain.com/mcp` — the PropXchain MCP
  server (Model Context Protocol over Streamable HTTP).
- **Authorization server:** `https://auth.propxchain.com` — OAuth 2.1.

A grant only says what your agent *may attempt* — every consequential action
still stops at a human consent checkpoint inside PropXchain.

---

## 1. Connect an MCP client (claude.ai, Claude Desktop, Claude Code)

Add a custom connector with the URL `https://mcp.propxchain.com/mcp` and leave
the OAuth client ID and secret blank. The client discovers the rest
(section 2), then:

- The user approves at `https://auth.propxchain.com/authorize` with their
  PropXchain email and a 6-digit code sent to it. Consent grants every scope,
  consequential ones included.
- The flow is the OAuth 2.1 authorization code grant with PKCE (`S256`). The
  client identifies itself with a Client ID Metadata Document and
  authenticates as a public client (`none`). Documents hosted on `claude.ai`
  and `claude.com` are accepted today.
- A connection sees a transaction only after the user gives it that
  transaction's invite code (`propxchain_join_transaction_as_bot`). Any party
  can remove it again from the transaction's bot panel.

---

## 2. Discover

Two hops.

**2a. Call the MCP endpoint without a credential.** You get a `401` pointing
at the PRM:

```http
POST https://mcp.propxchain.com/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
```
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.propxchain.com/.well-known/oauth-protected-resource/mcp"
```

**2b. Fetch the PRM**, then the authorization-server metadata it names:

```http
GET https://mcp.propxchain.com/.well-known/oauth-protected-resource/mcp
```
```json
{
  "resource": "https://mcp.propxchain.com/mcp",
  "resource_name": "PropXchain",
  "authorization_servers": ["https://auth.propxchain.com"],
  "scopes_supported": ["chain:read","tx:read","panel:read","quote:read","aml:write","conveyancer:instruct","exchange:confirm","completion:funds"],
  "bearer_methods_supported": ["header"]
}
```
```http
GET https://auth.propxchain.com/.well-known/oauth-authorization-server
```

The response is RFC 8414 metadata: `authorization_endpoint`, `token_endpoint`,
`introspection_endpoint`, `code_challenge_methods_supported: ["S256"]`,
`token_endpoint_auth_methods_supported: ["none"]` and
`client_id_metadata_document_supported: true`.

---

## 3. Tokens

- **Access token:** 60 minutes, minted for the MCP endpoint only. Send it as
  `Authorization: Bearer <access_token>` on every call.
- **Refresh token:** `POST https://auth.propxchain.com/token` with
  `grant_type=refresh_token` (`application/x-www-form-urlencoded`). Every use
  returns a new refresh token and retires the old one. Presenting a retired
  refresh token revokes the connection.
- **Grant:** 30 days. After that, refresh fails and the user approves again.

---

## 4. Errors

| Where        | Response                               | What to do |
|--------------|----------------------------------------|-----------|
| `/mcp`       | `401` + `WWW-Authenticate`             | Refresh the access token. If refresh fails, start the authorization again. |
| `/token`     | `400 invalid_grant`                    | The code or refresh token was used, expired, or the grant was revoked. Start the authorization again. |
| `/token`     | `400 invalid_request` / `unsupported_grant_type` / `invalid_target` | Fix the request (form encoding, grant type, `resource` = the MCP URL). |
| `/authorize` | page: "Couldn't connect to PropXchain" | The `client_id` is not an accepted client metadata document, or its `redirect_uri` is not registered. |
| any          | `429 rate_limited`                     | Back off; honour `Retry-After`. |

---

## Retired: auth.md self-registration

The open self-registration endpoints (`/agent/auth`, `/agent/auth/claim`,
`/agent/auth/claim/complete`, `/agent/auth/revoke`) were retired on
17 September 2026. The MCP endpoint accepts OAuth access tokens only, so their
credentials had nothing to call. Connect with an MCP client instead
(section 1).

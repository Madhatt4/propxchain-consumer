---
name: propxchain-agent-auth
description: Authenticate an AI agent or MCP client to PropXchain's conveyancing API (mcp.propxchain.com) using OAuth 2.1 with PKCE via auth.propxchain.com. Use when connecting to PropXchain, handling a 401 from the MCP endpoint, refreshing tokens, or diagnosing invalid_grant errors.
---

# PropXchain agent authentication

PropXchain exposes UK property conveyancing transactions to agents through a
Model Context Protocol endpoint. Access is OAuth 2.1, authorization-code grant
with PKCE (`S256`), public client (`token_endpoint_auth_methods_supported:
["none"]`), and the client identifies itself with a Client ID Metadata
Document. Consent is given by a human with their PropXchain email and a 6-digit
code. The prose companion is <https://propxchain.com/auth.md>.

## Quick start (MCP clients)

Add a custom connector with URL `https://mcp.propxchain.com/mcp`. Leave client
ID and secret blank. The client discovers the rest and opens the consent page.

## Discover (two hops)

1. Call the MCP endpoint without a credential. The `401` carries
   `WWW-Authenticate: Bearer resource_metadata="https://mcp.propxchain.com/.well-known/oauth-protected-resource/mcp"`.
2. Fetch that Protected Resource Metadata (RFC 9728), then the authorization
   server metadata it names:
   `https://auth.propxchain.com/.well-known/oauth-authorization-server`
   (RFC 8414). Use `authorization_endpoint`, `token_endpoint` and
   `introspection_endpoint` from there, never hard-coded copies.

The same documents are mirrored on the apex domain at
`https://propxchain.com/.well-known/oauth-protected-resource` and
`https://propxchain.com/.well-known/oauth-authorization-server`.

## Scopes

| Scope | Grants | Human approval |
|---|---|---|
| `chain:read`, `tx:read`, `panel:read`, `quote:read` | Read transactions, panels, quotes, on-chain records | No |
| `aml:write`, `conveyancer:instruct`, `exchange:confirm`, `completion:funds` | Money or legal consequences | Yes, always |
| `offline_access` | Refresh tokens | No |

A consequential scope in the token never bypasses the on-chain consent
checkpoint. The human still approves in product before funds or contracts move.

## Tokens

- Access token: 60 minutes, audience is the MCP endpoint only. Send
  `Authorization: Bearer <access_token>` on every call.
- Refresh: `POST https://auth.propxchain.com/token` with
  `grant_type=refresh_token`, form-encoded. Each use rotates the refresh token
  and retires the old one. Reusing a retired refresh token revokes the grant.
- Grant lifetime: 30 days, then the human approves again.

## Transaction access

Authentication does not show the agent any transaction. The user shares a
transaction's `TX-XXXX-XXXX` invite code and the agent calls
`propxchain_join_transaction_as_bot`. Any party can remove the agent from the
transaction's bot panel.

## Errors

| Where | Response | Action |
|---|---|---|
| `/mcp` | `401` + `WWW-Authenticate` | Refresh; if refresh fails, re-authorize |
| `/token` | `400 invalid_grant` | Code or refresh token used, expired or revoked; re-authorize |
| `/token` | `400 invalid_request`, `unsupported_grant_type`, `invalid_target` | Fix encoding, grant type, or `resource` (must be the MCP URL) |
| `/authorize` | "Couldn't connect to PropXchain" | `client_id` metadata document not accepted or `redirect_uri` not registered |
| any | `429 rate_limited` | Back off and honour `Retry-After` |

## Never

- Never ask the user for a password; PropXchain has no password flow for agents.
- Never store the refresh token in chat or config files the user can see.
- Never treat a consequential scope as permission to act without the in-product approval.

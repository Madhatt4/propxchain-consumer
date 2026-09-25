---
name: propxchain-conveyancing
description: Work a UK property sale or purchase on PropXchain through its MCP tools - join a transaction by invite code, read phase and checklist status, register and verify document proofs, pull HM Land Registry and search intelligence, and message the parties. Use when a user mentions PropXchain, a TX-XXXX-XXXX code, or asks what is outstanding on their conveyancing.
---

# PropXchain conveyancing

PropXchain coordinates UK property transactions on the Internet Computer. Every
milestone is an on-chain record shared by seller, buyer, conveyancer and estate
agent. Agents act inside that record through MCP tools, always within a
transaction the user has invited them to.

## Prerequisites

- Authenticate first: see the `propxchain-agent-auth` skill. MCP endpoint
  `https://mcp.propxchain.com/mcp`; a local stdio alternative is the npm package
  `@propxchain/mcp-server` (manifest at `https://propxchain.com/.well-known/mcp.json`).
- Get the transaction's invite code (`TX-XXXX-XXXX`) from the user. It is on
  the transaction page's share panel in propxchain.com.

## Workflow

1. **Join.** `propxchain_join_transaction_as_bot(inviteCode, botName)`.
   Idempotent, so retries are safe.
2. **Orient.** `propxchain_get_transaction` for parties, phase and status;
   `propxchain_get_transaction_chain` when the sale depends on a linked
   purchase; `propxchain_list_my_transactions` if the user has several.
3. **Find the next step.** `propxchain_next_step` and
   `propxchain_get_checklist`. Report outstanding items in plain English,
   grouped by who owns them (seller, buyer, conveyancer).
4. **Documents.** `propxchain_list_documents` to see what is filed.
   `propxchain_upload_document` registers a SHA-256 hash on-chain; the file
   itself stays on the user's device. `propxchain_verify_document` checks a
   file against its on-chain proof.
5. **Property facts.** `propxchain_get_property_intel` for HM Land Registry
   title data, search results and address intelligence.
6. **Communicate.** `propxchain_send_message` posts to the transaction thread
   every party can see. Keep messages factual and short.
7. **Progress.** `propxchain_update_checklist` only for items the user has
   asked you to mark and that you have evidence for.

## Explaining the process

`propxchain_explain_process` returns the plain-English description of any
stage (instruction, searches, enquiries, exchange, completion). Prefer it over
your own summary so the user gets PropXchain's current wording.

## Rules

- Quote panel options and prices exactly as the tools return them. Never
  invent a fee or a provider.
- Money and legal actions (AML checks, instructing a conveyancer, confirming
  exchange, releasing completion funds) always need the user's in-product
  approval. Present the options, summarise trade-offs, wait for their choice.
- Personal data stays off-chain. Do not paste names, emails or ID documents
  into on-chain fields or messages.
- If a tool returns `401`, refresh the token; if that fails, re-authorize.
  Do not retry consequential writes blindly.

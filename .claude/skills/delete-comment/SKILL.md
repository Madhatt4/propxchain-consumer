---
name: delete-comment
description: Use when sweeping code comments out of a directory or file in a PropXchain repo, when the comment ratchet (scripts/check-comments.mjs) is in play, or when asked to "delete comments", "run the comment sweep" or "/delete-comment <path>".
---

# delete-comment

Clears every code comment from one area of the repo. Nothing the comments knew is lost: each one is deleted, moved to an ADR, or turned into an issue. The CI ratchet (`scripts/check-comments.mjs`) then stops the count from growing back.

**Argument:** a path, for example `/delete-comment src/stores`. Without one, pick the smallest directory that has not been swept, list it to Marc, and confirm before you start. Keep one PR under ~400 comments.

## 1. List the comments

```bash
node -e "import('./scripts/check-comments.mjs').then(m=>{const ts=require('typescript');const fs=require('fs');for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,'utf8');for(const c of m.commentRanges(t,f,ts))console.log(f+':'+t.slice(0,c.pos).split('\n').length+'  '+c.raw.split('\n')[0].slice(0,100))}})" $(git ls-files <path> | grep -E '\.(ts|tsx|js|mjs|cjs|mo)$')
```

Read each file whole. A comment can only be judged next to its code.

## 2. Put each comment in exactly one category

| Category | Test | Action |
|---|---|---|
| **Tautology** | The code already says it (`// Selector hooks`, `/** Non-hook accessor */`, `// 1. Check session first`) | Delete |
| **Stale** | Names a plan step, ticket, old SDK version, internal note or file that no longer applies (`// 1a.9:`, `see project_x flow`) | Delete |
| **Excuse** | Explains why the code has to be odd: a cycle dodged with a dynamic import, a retry hiding a race, a value mirrored by hand, a name that needs a warning | Delete the comment and file an issue to remove the oddity |
| **Decision Record** | A non-obvious *why* that someone would undo without knowing it: ordering rules, security reasons, things deliberately not done or not persisted | Move into an ADR, then delete |

Before you reach for a category, ask whether a better name removes the need. `BigInt(86400e9) // 24h in ns` becomes `II_SESSION_TTL_NANOSECONDS`. That counts as a Tautology fixed by a rename.

Licence headers follow the repo's licence, not the sweep. The consumer repo is AGPL: a `Proprietary` header there is wrong, so replace it with `// SPDX-License-Identifier: AGPL-3.0-or-later` + `// Copyright (C) <year> PropXchain Ltd` (`check-license-headers.mjs` enforces this). The monorepo is private: its two-line `Copyright … All rights reserved.` private-licence header is correct, so leave it.

Directives are not comments and stay: `eslint-disable*`, `@ts-expect-error`, `@vite-ignore`, `deno-lint-ignore`, `/// <reference`, `@type {…}` in JS, and the two-line SPDX/Copyright header.

## 3. Decision Records → ADR

- **Monorepo (`Propxchain`)**: `docs/adr/NNNN-<slug>.md`, tracked; add it to `docs/adr/README.md`.
- **Consumer (`propxchain-consumer`)**: `docs/adr/` in the main checkout `C:\Users\Admin\Desktop\propxchain-consumer`, not a worktree. The repo is public and `*.md` is gitignored, so ADRs there are local-only by policy. Never commit one.

Group by subject: one ADR per concept (e.g. "sign-in and sign-out lifecycle"), not one per comment. Write the decision and its reason in plain sentences. List the Excuse issues under "Known debt".

## 4. Excuses → issues

One issue per oddity, on the repo the code lives in (`gh issue create`). Body: what the code does and why it was needed, the fix, and a checkable "Done when". The consumer repo is public: no internal names, prices, principals or vault paths.

## 5. Strip, tighten, verify

```bash
node scripts/strip-comments.mjs <files…>      # removes every non-directive comment
node scripts/check-comments.mjs --update      # lowers the baseline; refuses to raise it
node scripts/check-comments.mjs               # must print "Comment ratchet OK"
```

Then run the repo's type-check, lint and the tests for the touched area. Stripping a comment can leave an empty `catch {}` or block that lint flags. Fix it in code, never with a comment.

Branch, commit (`chore(comments): sweep <path>`), push, open the PR, and stop. Marc merges. In the PR body give: counts per category, the ADRs written, the issues filed, and lines removed.

## Common mistakes

- **Stripping before you've read the comments.** The stripper is the last step. A Decision Record deleted unread is knowledge lost.
- **Raising the baseline to get green.** `--update` refuses to. If a moved file trips the check, `--update` passes as long as the total didn't grow.
- **An ADR per comment.** Five comments about sign-out make one ADR.
- **Committing a consumer ADR.** It is gitignored on purpose.

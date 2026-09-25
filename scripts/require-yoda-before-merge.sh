#!/usr/bin/env bash
#
# PreToolUse(Bash) gate: refuse a PR merge unless Yoda has reviewed THAT commit.
#
# Why a harness hook and not an instruction: between 2026-06-01 and 2026-08-06 the
# Charter already said Yoda reviews every diff before merge, and it was skipped four
# times anyway -- three production diffs to mainnet on 08-06 plus a money-path commit
# straight to main. An instruction Claude can forget is not a gate. This runs whether
# or not Claude remembers it exists.
#
# This is the copy for a PRODUCT repo. The gate lived only in propxchain-cos until
# 2026-08-19, which left the obvious hole: a session started in THIS directory could
# merge without ever meeting it. The verdicts themselves stay in propxchain-cos --
# one record of what was reviewed, wherever the merge is run from.
#
# Wire it up in .claude/settings.json:
#   "hooks": { "PreToolUse": [ { "matcher": "Bash",
#     "hooks": [ { "type": "command",
#                  "command": "bash \"$CLAUDE_PROJECT_DIR/scripts/require-yoda-before-merge.sh\"" } ] } ] }
#
# Fails CLOSED: if it cannot work out which PR is being merged, it blocks.

set -uo pipefail

COS_ROOT="${PROPXCHAIN_COS_ROOT:-$HOME/Desktop/propxchain-cos}"
VERDICT_DIR="${YODA_VERDICT_DIR:-$COS_ROOT/state/yoda}"

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"

# Not a merge -- nothing to say.
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)' || exit 0

deny() {
  echo "$1" >&2
  exit 2   # exit 2 = block the tool call and show stderr to Claude
}

pr="$(printf '%s' "$cmd" | grep -oE 'gh[[:space:]]+pr[[:space:]]+merge[[:space:]]+[0-9]+' | grep -oE '[0-9]+$' | head -1)"
repo="$(printf '%s' "$cmd" | grep -oE '(-R|--repo)[[:space:]]+[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' | awk '{print $2}' | head -1)"

[ -n "$pr" ] || deny "BLOCKED: cannot tell which PR this merges (no explicit number), so the Yoda gate cannot verify it.
Run the merge with an explicit PR number and -R <owner/repo>."

if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
fi
[ -n "$repo" ] || deny "BLOCKED: cannot determine the repo for PR #${pr}. Pass -R <owner/repo>."

# Fail closed on a missing verdict store. Without this, the file check below could
# never be satisfied and every merge would block citing 'Yoda has not reviewed'
# when the real fault is a wrong path -- an error that sends you to fix the wrong thing.
[ -d "$VERDICT_DIR" ] || deny "BLOCKED: Yoda verdict store not found at ${VERDICT_DIR}.
Set PROPXCHAIN_COS_ROOT to the propxchain-cos checkout, or YODA_VERDICT_DIR to the verdict directory."

sha="$(gh pr view "$pr" -R "$repo" --json headRefOid -q .headRefOid 2>/dev/null || true)"
[ -n "$sha" ] || deny "BLOCKED: could not read PR #${pr} in ${repo} to check its head commit."

slug="$(echo "$repo" | tr '/' '-')-pr${pr}"
verdict="$VERDICT_DIR/${slug}-${sha:0:12}.md"

[ -f "$verdict" ] || deny "BLOCKED -- Charter Checker rule 3: Yoda has not reviewed ${repo}#${pr} at its current head (${sha:0:12}).

No verdict at: ${verdict}

Review it first, from the propxchain-cos checkout:
    bash scripts/yoda-review.sh --repo ${repo} --pr ${pr}

Then merge. If the branch has moved since an earlier review, that is the point --
the review must cover the code actually being merged, not an earlier version of it."

echo "Yoda verdict present for ${repo}#${pr} @ ${sha:0:12} -- merge gate satisfied (advisory; read it before merging)." >&2
exit 0

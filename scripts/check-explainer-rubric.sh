#!/usr/bin/env bash
# Fails if EXPLAINER_RUBRIC stops being the sole, leading system message.
#
# The rubric is byte-identical on every call. Providers give a prefix discount
# only when the leading bytes are unchanging, so the rubric must be its own
# system message, first in the array, never concatenated with the per-call
# analysis. Splicing per-call bytes in front of it — or into it — silently
# destroys the cache hit rate for every request.
#
# Cheap to check, easy to regress in a refactor, and the failure is invisible
# at runtime: the code still works, it just costs more forever.
set -euo pipefail

FN_DIR="supabase/functions/searches-explainer"
FILE="$FN_DIR/explainer.ts"

# 1. The rubric must be passed whole, as its own system message.
ALLOWED="role: 'system', content: EXPLAINER_RUBRIC }"

if ! grep -qF "$ALLOWED" "$FILE"; then
  echo "FAIL: EXPLAINER_RUBRIC is not being sent as its own system message."
  echo "Expected a messages entry exactly: { role: 'system', content: EXPLAINER_RUBRIC }"
  exit 1
fi

# 2. It must never be concatenated or interpolated with anything else.
if grep -n "EXPLAINER_RUBRIC" "$FILE" | grep -v "^[0-9]*:import" | grep -vF "$ALLOWED" | grep -q .; then
  echo "FAIL: EXPLAINER_RUBRIC is referenced somewhere other than its import and"
  echo "the system message. It must not be concatenated, interpolated or reused."
  grep -n "EXPLAINER_RUBRIC" "$FILE" | grep -v "^[0-9]*:import" | grep -vF "$ALLOWED"
  exit 1
fi

# 3. The system message must come FIRST — a user message ahead of it would put
#    per-call bytes in the cached prefix position.
SYSTEM_LINE=$(grep -n "role: 'system'" "$FILE" | head -1 | cut -d: -f1)
USER_LINE=$(grep -n "role: 'user'" "$FILE" | head -1 | cut -d: -f1)
if [ -z "$SYSTEM_LINE" ] || [ -z "$USER_LINE" ] || [ "$SYSTEM_LINE" -ge "$USER_LINE" ]; then
  echo "FAIL: the system message must appear before the user message."
  echo "system at line ${SYSTEM_LINE:-none}, user at line ${USER_LINE:-none}"
  exit 1
fi

echo "OK: EXPLAINER_RUBRIC is the sole, leading system message."

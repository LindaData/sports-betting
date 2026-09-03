#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Reads the tool call from stdin and, when the
# command is a `git commit`, scans the staged diff for obvious credentials.
# Exit 2 blocks the commit and feeds the message back to Claude. Exit 0 passes.
#
# Enforces the CSO/CIO non-negotiable in AGENTS.md: no credentials, .env,
# .Renviron, or private provider exports reach the repository.
set -u

payload="$(cat)"
command="$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)"

case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Forbidden file names anywhere in the staged set.
bad_files="$(git diff --cached --name-only 2>/dev/null \
  | grep -E '(^|/)(\.env(\..+)?|\.Renviron|.*\.p8|.*\.p12|.*\.mobileprovision|.*\.pem|.*\.key)$' \
  | grep -vE '(^|/)\.env\.(example|sample|template)$' || true)"

# Forbidden content in staged additions.
bad_content="$(git diff --cached -U0 2>/dev/null | grep -E '^\+' | grep -nE \
  '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|sk-ant-[0-9a-zA-Z_-]{20,}|ghp_[0-9a-zA-Z]{30,}|xox[baprs]-[0-9A-Za-z-]{10,}|AIza[0-9A-Za-z_-]{30,}|(api[_-]?key|secret|token|password)\s*[:=]\s*["'"'"'][A-Za-z0-9_/+=-]{16,}["'"'"'])' \
  || true)"

if [ -n "$bad_files" ] || [ -n "$bad_content" ]; then
  echo "Commit blocked by .claude/hooks/check-secrets.sh (CSO/CIO rule)."
  [ -n "$bad_files" ]   && { echo "Forbidden files staged:"; echo "$bad_files" | sed 's/^/  /'; }
  [ -n "$bad_content" ] && { echo "Credential-shaped content in staged diff:"; echo "$bad_content" | cut -c1-160 | sed 's/^/  /'; }
  echo "Unstage the offending files or replace the values with environment lookups, then commit again."
  exit 2
fi
exit 0

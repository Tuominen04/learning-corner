#!/usr/bin/env bash
# Checks the documentation conventions described in docs/CONVENTIONS.md:
#   1. every Markdown page carries its Audience / Status / Last reviewed header
#   2. every relative link points at something that exists
#   3. no page under docs/user/ leaks implementation vocabulary
#
# Usage: bash docs/check-docs.sh   (exit 0 = clean, 1 = problems found)

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
fail=0
note() { printf '  %s\n' "$1"; fail=1; }

docs=$(find docs -name '*.md' | sort)

# --- 1. headers -------------------------------------------------------------
echo "Checking page headers…"
for f in $docs; do
  for field in Audience Status 'Last reviewed'; do
    grep -q "^> \*\*${field}:\*\*" "$f" || note "$f: missing '${field}:' in header"
  done
done

# --- 2. relative links ------------------------------------------------------
echo "Checking relative links…"
links=$(mktemp)
for f in $docs README.md; do
  dir=$(dirname "$f")
  # pull ](target) out of Markdown links, drop external ones and #anchors
  grep -o '](\([^)]*\))' "$f" 2>/dev/null | sed 's/^](//; s/)$//' \
  | while read -r target; do
      case "$target" in http*|mailto:*|'#'*|'') continue ;; esac
      target=${target%%#*}
      [ -e "$dir/$target" ] || printf '%s: dead link -> %s\n' "$f" "$target"
    done
done > "$links"
if [ -s "$links" ]; then
  while IFS= read -r line; do note "$line"; done < "$links"
fi
rm -f "$links"

# --- 3. implementation vocabulary in the user guide -------------------------
echo "Checking docs/user/ for implementation vocabulary…"
banned='Rust|Tauri|SQLite|JSON|YAML|TOML|npm|cargo|Node\.js|API|endpoint|schema|database|IPC|daemon|serialis|serializ|SHA-256|hash|checksum|front matter|git|GitHub|source code|repositor'
if hits=$(grep -rIniE "(^|[^[:alnum:]_-])(${banned})([^[:alnum:]_-]|$)" docs/user/ 2>/dev/null); then
  echo "$hits" | while IFS= read -r line; do printf '  %s\n' "$line"; done
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All documentation checks passed."
else
  echo "Documentation checks FAILED — see above, and docs/CONVENTIONS.md for the rules."
fi
exit "$fail"

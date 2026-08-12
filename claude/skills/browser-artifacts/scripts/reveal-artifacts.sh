#!/usr/bin/env bash
# Reveal the most recent browser-tester screenshots + recordings in Finder.
#
# Artifacts are not session-scoped on disk, so "this session" = the newest
# cluster of files, walking back from the newest until a gap larger than
# GAP_SECONDS. A browser-tester run writes its screenshots and video within
# a couple of minutes, so 20 min groups consecutive runs and excludes older days.
#
# Usage: reveal-artifacts.sh [--all] [path]
#   --all   skip the cluster filter; take everything in the folder
#   path    repo/worktree root, or a .playwright-cli dir (default: auto-detect)

set -eo pipefail

GAP_SECONDS=${GAP_SECONDS:-1200}
ALL=0
TARGET=""

for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
    -*)    echo "unknown flag: $arg" >&2; exit 2 ;;
    *)     TARGET="$arg" ;;
  esac
done

newest_mtime() {
  # newest artifact mtime under a .playwright-cli dir, or nothing
  find "$1" "$1/recordings" -maxdepth 1 -type f \
    \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \
       -o -iname '*.webm' -o -iname '*.mp4' -o -iname '*.gif' \) 2>/dev/null \
    | while IFS= read -r f; do stat -f '%m' "$f"; done | sort -rn | head -1
}

resolve_base() {
  if [ -n "$TARGET" ]; then
    case "${TARGET%/}" in
      */.playwright-cli) [ -d "${TARGET%/}" ] && { printf '%s\n' "${TARGET%/}"; return 0; } ;;
    esac
    [ -d "${TARGET%/}/.playwright-cli" ] && { printf '%s\n' "${TARGET%/}/.playwright-cli"; return 0; }
    echo "No .playwright-cli found under: $TARGET" >&2
    return 1
  fi

  [ -d "$PWD/.playwright-cli" ] && { printf '%s\n' "$PWD/.playwright-cli"; return 0; }

  root=$(git rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$root" ] && [ -d "$root/.playwright-cli" ] && { printf '%s\n' "$root/.playwright-cli"; return 0; }

  # The run may have happened in another worktree of this repo. Bounded search:
  # ask git, not the filesystem. Most recently written wins.
  best=""; best_ts=0
  while IFS= read -r wt; do
    [ -d "$wt/.playwright-cli" ] || continue
    ts=$(newest_mtime "$wt/.playwright-cli")
    [ -n "$ts" ] || continue
    if [ "$ts" -gt "$best_ts" ]; then best_ts=$ts; best="$wt/.playwright-cli"; fi
  done < <(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}')

  [ -n "$best" ] && { printf '%s\n' "$best"; return 0; }
  return 1
}

BASE=$(resolve_base) || {
  if [ -z "$TARGET" ]; then
    echo "No browser-tester artifacts found. Looked in \$PWD, the git root, and this repo's worktrees." >&2
    echo "Pass a path explicitly if the run happened elsewhere: reveal-artifacts.sh /path/to/worktree" >&2
  fi
  exit 1
}

# mtime<TAB>path, newest first
ROWS=$(find "$BASE" "$BASE/recordings" -maxdepth 1 -type f \
  \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \
     -o -iname '*.webm' -o -iname '*.mp4' -o -iname '*.gif' \) 2>/dev/null \
  | while IFS= read -r f; do printf '%s\t%s\n' "$(stat -f '%m' "$f")" "$f"; done \
  | sort -rn) || true

if [ -z "$ROWS" ]; then
  echo "Folder: $BASE"
  echo "No screenshots or recordings in it yet."
  exit 0
fi

SELECTED=()
prev=""
while IFS=$'\t' read -r ts path; do
  if [ "$ALL" -eq 0 ] && [ -n "$prev" ] && [ $((prev - ts)) -gt "$GAP_SECONDS" ]; then
    break
  fi
  SELECTED+=("$path")
  prev=$ts
done <<< "$ROWS"

echo "Folder:  $BASE"
[ "$ALL" -eq 1 ] && echo "Scope:   all artifacts" \
                 || echo "Scope:   latest run cluster (${#SELECTED[@]} of $(printf '%s\n' "$ROWS" | wc -l | tr -d ' ') files, ${GAP_SECONDS}s gap)"
echo
for f in "${SELECTED[@]}"; do
  printf '%s  %s\n' "$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$f")" "$f"
done

if command -v open >/dev/null 2>&1; then
  open -R "${SELECTED[@]}"
  echo
  echo "Revealed in Finder (selected)."
fi

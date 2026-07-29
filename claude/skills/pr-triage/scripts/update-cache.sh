#!/usr/bin/env bash
# Persist triage verdicts to the cache so the next run skips unchanged PRs and
# never re-runs a code review for a head SHA already reviewed.
#
# Reads a verdicts JSON array from stdin and writes the full cache for the repo.
# The cache is REPLACED with exactly the PRs passed in (already-pruned set), so
# pass every candidate from this run — freshly reviewed AND carried-over.
#
# Usage: echo '<verdicts-json>' | update-cache.sh <owner/repo>
#   verdict object:
#     { number, headRefOid, reviewed, decision, reason,
#       risk?, red?, yellow?, effort? }
#   - reviewed: true if a /code-review actually ran at this headRefOid (reusable);
#               false for a provisional Hold (draft / red CI / conflict — the cheap
#               gate is re-checked next run even at the same SHA).
#   - red/yellow: 🔴 Important / 🟡 Nit counts from the review (0 when not reviewed).
#   - effort: the /code-review effort level used (e.g. "low", "medium").
#   lastTriaged is stamped to today automatically.
set -euo pipefail

repo="${1:?usage: update-cache.sh <owner/repo>}"
today="$(date +%F)"
cache_file="$HOME/.claude/pr-triage/${repo//\//-}.json"
mkdir -p "$(dirname "$cache_file")"

verdicts="$(cat)"

jq -n --argjson v "$verdicts" --arg today "$today" '
  reduce $v[] as $x ({};
    .[($x.number|tostring)] = ({
      headRefOid: $x.headRefOid,
      lastTriaged: $today,
      reviewed: ($x.reviewed // false),
      decision: $x.decision,
      reason: $x.reason
    } + ({risk: $x.risk, red: $x.red, yellow: $x.yellow, effort: $x.effort}
         | with_entries(select(.value != null)))))' > "$cache_file"

echo "wrote $(jq 'length' "$cache_file") entries to $cache_file"

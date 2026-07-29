#!/usr/bin/env bash
# Emit the PR-triage candidate set for a repo, diffed against the on-disk cache.
#
# Candidates = open, non-draft PRs whose reviewDecision is NOT APPROVED (active).
# Each candidate carries changed=true when it is new or its head SHA moved since
# the last run. When changed=false the full cached entry is attached under
# `cached` so the caller can reuse a completed review WITHOUT running one again
# (this is the token-saver / "never review the same SHA twice" guarantee).
#
# Usage: select-candidates.sh [owner/repo] [limit]
#   owner/repo  defaults to the current repo (gh repo view)
#   limit       defaults to 20
#
# Output (stdout): JSON { repo, today, cacheFile, candidates:[...], pruned:[...] }
#   candidate: { number, title, author, isDraft, reviewDecision, headRefOid,
#                updatedAt, changed, cached }
#     cached (only when changed=false): the stored entry, e.g.
#       { headRefOid, lastTriaged, reviewed, decision, reason, risk, red, yellow, effort }
#   pruned:    cache entries no longer active (approved/merged/closed) — drop them.
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
limit="${2:-20}"
today="$(date +%F)"

cache_dir="$HOME/.claude/pr-triage"
cache_file="$cache_dir/${repo//\//-}.json"
mkdir -p "$cache_dir"

# Tolerant cache read: unparseable/missing cache -> {} (all PRs treated as changed).
cache="$(jq -e . "$cache_file" 2>/dev/null || echo '{}')"

# Live active PRs: open AND not draft AND not APPROVED.
live="$(gh pr list --repo "$repo" --state open --limit "$limit" \
  --json number,title,author,isDraft,reviewDecision,headRefOid,updatedAt \
  | jq '[.[] | select(.reviewDecision != "APPROVED" and (.isDraft | not))
         | {number, title, author: .author.login, isDraft, reviewDecision, headRefOid, updatedAt}]')"

candidates="$(jq -n --argjson live "$live" --argjson cache "$cache" '
  $live | map(
    . as $pr
    | ($cache[($pr.number|tostring)]) as $c
    | if ($c != null) and ($c.headRefOid == $pr.headRefOid)
      then $pr + {changed: false, cached: $c}
      else $pr + {changed: true, cached: null}
      end)')"

# Pruned = cached PR numbers that are no longer in the live active set.
pruned="$(jq -n --argjson live "$live" --argjson cache "$cache" '
  ($live | map(.number|tostring)) as $activeNums
  | [$cache | to_entries[] | select(.key as $k | ($activeNums | index($k)) | not) | .key | tonumber]')"

jq -n \
  --arg repo "$repo" --arg today "$today" --arg cacheFile "$cache_file" \
  --argjson candidates "$candidates" --argjson pruned "$pruned" \
  '{repo: $repo, today: $today, cacheFile: $cacheFile, candidates: $candidates, pruned: $pruned}'

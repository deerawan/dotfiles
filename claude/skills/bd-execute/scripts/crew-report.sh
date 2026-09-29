#!/usr/bin/env bash
set -euo pipefail

# Render the crew status report as markdown, read fresh from the run dir + gh + herdr.
# Usage: crew-report.sh [<run-dir>] [--phase N]
# No run-dir: uses the only run under ~/.claude/bd-execute/, or lists them and exits 2.
# STUCK_MINUTES (default 30): a running task idle this long is flagged stuck.

runs_root="$HOME/.claude/bd-execute"
run_dir=""; phase=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase) phase="$2"; shift 2;;
    *) run_dir="$1"; shift;;
  esac
done
stuck_minutes="${STUCK_MINUTES:-30}"

if [[ -z "$run_dir" ]]; then
  runs=()
  for d in "$runs_root"/*/; do [[ -f "$d/crew.json" ]] && runs+=("${d%/}"); done
  if [[ ${#runs[@]} -eq 0 ]]; then
    echo "no bd-execute run under $runs_root — nothing to report"; exit 1
  fi
  if [[ ${#runs[@]} -gt 1 ]]; then
    echo "multiple runs — pass one:"
    for d in "${runs[@]}"; do
      latest="$(find "$d" -maxdepth 1 -name 'task-*.status' -exec stat -f '%m' {} + 2>/dev/null | sort -n | tail -1)"
      echo "  $(basename "$d")  updated $(date -r "${latest:-0}" '+%Y-%m-%d %H:%M')"
    done
    exit 2
  fi
  run_dir="${runs[0]}"
fi
[[ -d "$run_dir" ]] || { echo "run dir not found: $run_dir" >&2; exit 1; }

source "$(dirname "$0")/gates.sh"

slug="$(basename "$run_dir")"
index="$run_dir/EXECUTION.md"
roster="$run_dir/crew.json"
repo=""; plan=""
if [[ -f "$index" ]]; then
  repo="$(sed -n 's/^Repo: *\([^ ]*\).*/\1/p' "$index" | head -1)"
  plan="$(sed -n 's/^Plan: *//p' "$index" | head -1)"
fi
plan="${plan/#\~/$HOME}"

if [[ -z "$phase" && -f "$index" ]]; then
  phase_rows="$(grep -E '^\| *[0-9]+ *\|' "$index" || true)"
  phase="$(echo "$phase_rows" | awk -F'|' 'tolower($5) ~ /in progress/ {gsub(/ /,"",$2); p=$2} END {print p}')"
  [[ -n "$phase" ]] || phase="$(echo "$phase_rows" | tail -1 | awk -F'|' '{gsub(/ /,"",$2); print $2}')"
fi
phase_file="$run_dir/phases/phase-$phase.md"

ids=()
if [[ -f "$phase_file" ]]; then
  while read -r id; do ids+=("$id"); done < <(
    awk -F'|' '/^\| *Task *\|/ {t=1; next} t && /^\|[- |]+$/ {next} t && /^\|/ {split($2,a," "); print a[1]; next} t {exit}' "$phase_file")
fi
if [[ -f "$roster" ]]; then
  while read -r id; do
    [[ " ${ids[*]:-} " == *" $id "* ]] || ids+=("$id")
  done < <(jq -r 'to_entries[] | select(.value | type == "object") | .key' "$roster")
fi
[[ ${#ids[@]} -gt 0 ]] || { echo "no tasks in $slug${phase:+ phase $phase}"; exit 0; }

field() { jq -r "$2 // empty" "$1" 2>/dev/null || true; }

branch_of() {
  local id="$1" b=""
  b="$(field "$run_dir/task-$id.status" .branch)"
  [[ -n "$b" ]] || b="$(jq -r --arg id "$id" '.[$id].branch // empty' "$roster" 2>/dev/null || true)"
  [[ -n "$b" || ! -f "$phase_file" ]] || b="$(awk -F'|' -v id="$id" '{split($2,a," ")} a[1]==id {gsub(/ /,"",$3); print $3; exit}' "$phase_file")"
  echo "$b"
}

base_of() {
  local id="$1" b=""
  b="$(field "$run_dir/task-$id.status" .base)"
  [[ -n "$b" ]] || b="$(jq -r --arg id "$id" '.[$id].parent // empty' "$roster" 2>/dev/null || true)"
  [[ -n "$b" || ! -f "$phase_file" ]] || b="$(awk -F'|' -v id="$id" '{split($2,a," ")} a[1]==id {gsub(/ /,"",$4); print $4; exit}' "$phase_file")"
  echo "$b"
}

title_of() {
  local id="$1" num="${1#t}" t=""
  [[ -f "$plan" ]] && t="$(grep -m1 -E "^#+ Task $num( |:|\()" "$plan" | sed -E 's/^#+ Task [^:]*: *//; s/`//g' || true)"
  [[ ${#t} -le 40 ]] || t="${t:0:39}…"
  echo "${t:-$(branch_of "$id")}"
}

pairs=""
for id in "${ids[@]}"; do pairs+="$id $(branch_of "$id") $(base_of "$id")"$'\n'; done

depth_of() {
  local base="$2" d=0 parent
  while parent="$(echo "$pairs" | awk -v b="$base" '$2==b {print $1; exit}')" && [[ -n "$parent" && $d -lt 20 ]]; do
    d=$((d + 1)); base="$(echo "$pairs" | awk -v p="$parent" '$1==p {print $3; exit}')"
  done
  echo "$d"
}

gate_icon() {
  case "$(echo "$1" | tr ' ' '\n' | sed -n "s/^$2://p")" in
    ok) echo "✅";; skipped) echo "⏭️";; no-demo) echo "⚠️";; *) echo "❌";;
  esac
}

gh_pr() {
  [[ -n "$1" && -d "$repo" ]] || return 0
  (cd "$repo" && gh pr view "$1" --json number,url,isDraft,state,reviewDecision 2>/dev/null) || true
}

age_minutes() {
  local since
  since="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$1" +%s 2>/dev/null || date -u -d "$1" +%s 2>/dev/null || echo "")"
  [[ -n "$since" ]] && echo $(( ($(date +%s) - since) / 60 ))
}

human_age() {
  if (( $1 >= 1440 )); then echo "$(( $1 / 1440 ))d"
  elif (( $1 >= 60 )); then echo "$(( $1 / 60 ))h"
  else echo "$1m"; fi
}

rows=""; notes=""; gate_failures=""
for id in "${ids[@]}"; do
  status="$run_dir/task-$id.status"
  state="$(field "$status" .state)"; state="${state:-pending}"
  branch="$(branch_of "$id")"

  gates="$(gate_results "$run_dir" "$id")"
  review="$(gate_icon "$gates" review)"; verify="$(gate_icon "$gates" verify)"
  tester="$(gate_icon "$gates" testing)"; body="$(gate_icon "$gates" pr)"
  [[ "$tester" == "⏭️" ]] && notes+="- ⏭️ **$id**: no matching tester (task-$id.testing.md)"$'\n'

  pr="—"; pr_state="Not submitted"; approval="—"
  pr_json="$(gh_pr "$branch")"
  if [[ -n "$pr_json" ]]; then
    pr="[#$(jq -r .number <<<"$pr_json")]($(jq -r .url <<<"$pr_json"))"
    pr_state="$(jq -r 'if .state == "MERGED" then "Merged" elif .state == "CLOSED" then "Closed" elif .isDraft then "Draft" else "Active" end' <<<"$pr_json")"
    approval="$(jq -r '{APPROVED: "✅ Approved", CHANGES_REQUESTED: "Changes requested", REVIEW_REQUIRED: "Review required"}[.reviewDecision // ""] // "—"' <<<"$pr_json")"
  fi

  if [[ "$state" == "blocked" ]]; then
    note="$(field "$status" .note)"
    [[ ${#note} -le 160 ]] || note="${note:0:159}… (full note in task-$id.status)"
    notes+="- 🟥 **$id**: blocked — $note"$'\n'
  elif [[ "$state" == "running" ]]; then
    agent="$(jq -r --arg id "$id" '.[$id].name // empty' "$roster" 2>/dev/null || true)"
    herdr_state="gone"
    [[ -n "$agent" ]] && herdr_state="$(herdr agent get "$agent" 2>/dev/null | jq -r '.result.agent.agent_status // "gone"' || echo gone)"
    age="$(age_minutes "$(field "$status" .updated_at)")"
    if [[ -n "$age" && "$age" -ge "$stuck_minutes" && ( "$herdr_state" == "idle" || "$herdr_state" == "gone" ) ]]; then
      unread=0
      [[ -d "$run_dir/task-$id.inbox" ]] && unread="$(find "$run_dir/task-$id.inbox" -maxdepth 1 -name '[0-9]*.msg' | wc -l | tr -d ' ')"
      notes+="- 🟥 **$id**: running $(human_age "$age"), agent \`$herdr_state\`, $unread unread inbox message(s)"$'\n'
    fi
  fi

  if [[ "$state" == "done" && ( "$gates" == *missing* || "$gates" == *no-demo* || "$gates" == *failed* ) ]]; then
    gate_failures+="${gate_failures:+, }$id"
  fi

  if [[ "$pr_state" == "Merged" ]] && jq -e --arg id "$id" 'has($id)' "$roster" >/dev/null 2>&1; then
    notes+="- 🔁 **$id** merged, lane still on disk. Retire it?"$'\n'
  fi

  rows+="$(depth_of "$id" "$(base_of "$id")")"$'\t'"| $id — $(title_of "$id") | $state | $review | $verify | $tester | $body | $pr | $pr_state | $approval |"$'\n'
done

echo "**Crew status — $slug${phase:+, phase $phase}** (merge bottom-up · ${#ids[@]} tasks · updated $(date -u +%H:%M) UTC)"
echo
echo "| Task | State | Review | Verify | Tester | PR body | PR | PR state | Approval |"
echo "|---|---|---|---|---|---|---|---|---|"
printf '%s' "$rows" | sort -s -t$'\t' -k1,1n | cut -f2-
[[ -z "$gate_failures" ]] || notes+="- ❌ **done with a failed gate:** $gate_failures — marked done outside write-status.sh or before the gate existed; \`gates.sh <run-dir> <id>\` shows which"$'\n'
if [[ -n "$notes" ]]; then
  echo
  printf '%s' "$notes"
fi

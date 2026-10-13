#!/usr/bin/env bash
set -euo pipefail

run_dir="${1:?run-dir required}"; task_id="${2:?task-id required}"; state="${3:?state required}"
shift 3
branch=""; base=""; pr=""; note=""; minor=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) branch="$2"; shift 2;;
    --base)   base="$2";   shift 2;;
    --pr)     pr="$2";     shift 2;;
    --note)   note="$2";   shift 2;;
    --minor)  minor+=("$2"); shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

case "$state" in pending|running|done|blocked) ;; *) echo "invalid state: $state" >&2; exit 2;; esac

if [[ "$state" == "done" ]]; then
  source "$(dirname "$0")/gates.sh"
  gates="$(gate_results "$run_dir" "$task_id")"
  if [[ "$gates" == *missing* || "$gates" == *no-demo* || "$gates" == *failed* ]]; then
    cat >&2 <<MSG
refusing done for $task_id: $gates
  review  -> bd-code-review verdict block (approve or approve-with-fixes) in $run_dir/task-$task_id.review.md
  verify  -> one "<check>: pass — <command>" line per unit/lint/typecheck run, none failing, in $run_dir/task-$task_id.verify.md
  testing -> domain tester report, or the line "no matching tester", in $run_dir/task-$task_id.testing.md
  pr      -> PR body via bd-pr in $run_dir/task-$task_id.pr.md, Demo/Screenshots section not empty
MSG
    exit 3
  fi
fi

mkdir -p "$run_dir"
f="$run_dir/task-$task_id.status"
tmp="$(mktemp "$run_dir/.task-$task_id.XXXXXX")"
now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

existing='{}'
[[ -f "$f" ]] && existing="$(cat "$f")"

if [[ ${#minor[@]} -gt 0 ]]; then
  minor_json="$(printf '%s\n' "${minor[@]}" | jq -R . | jq -s .)"
else
  minor_json='null'
fi

echo "$existing" | jq \
  --arg id "$task_id" --arg state "$state" --arg branch "$branch" \
  --arg base "$base" --arg pr "$pr" --arg note "$note" --arg now "$now" \
  --argjson minor "$minor_json" '
    .id = $id
    | .state = $state
    | .updated_at = $now
    | (if $branch != "" then .branch = $branch else . end)
    | (if $base   != "" then .base   = $base   else . end)
    | (if $pr     != "" then .pr     = $pr     else . end)
    | (if $note   != "" then .note   = $note   else . end)
    | (if $minor  != null then .minor_findings = $minor else . end)
  ' > "$tmp"
mv -f "$tmp" "$f"
echo "$f"

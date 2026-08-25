#!/usr/bin/env bash
set -euo pipefail

# Aggregate crewmate state: status file (source of truth) + live herdr agent state
# + unhandled steering-inbox count (see inbox-send.sh).
# Usage: crew-status.sh <run-dir> <task-id> [<task-id> ...]
# Prints one line per task: "<id> <file-state> <herdr-state> inbox:<unhandled>".
# Exit 0 iff every task's file-state is done or blocked (the wave has settled);
# the inbox count is informational and never affects settlement.

run_dir="${1:?run-dir required}"; shift
[[ $# -gt 0 ]] || { echo "no task ids given" >&2; exit 2; }

roster="$run_dir/crew.json"
all_settled=1
for id in "$@"; do
  f="$run_dir/task-$id.status"
  if [[ -f "$f" ]]; then
    state="$(jq -r '.state // "missing"' "$f")"
  else
    state="missing"
  fi

  herdr_state="-"
  if [[ -f "$roster" ]]; then
    # Address by agent NAME (layout-independent); fall back to pane id for old rosters.
    target="$(jq -r --arg id "$id" '.[$id].name // .[$id].pane // empty' "$roster")"
    if [[ -n "$target" ]]; then
      herdr_state="$(herdr agent get "$target" 2>/dev/null | jq -r '.result.agent.agent_status // "gone"' || echo "gone")"
    fi
  fi

  pending=0
  inbox="$run_dir/task-$id.inbox"
  if [[ -d "$inbox" ]]; then
    pending="$(find "$inbox" -maxdepth 1 -name '[0-9]*.msg' 2>/dev/null | wc -l | tr -d ' ')"
  fi

  echo "$id $state $herdr_state inbox:$pending"
  [[ "$state" == "done" || "$state" == "blocked" ]] || all_settled=0
done
[[ "$all_settled" -eq 1 ]]

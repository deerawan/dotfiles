#!/usr/bin/env bash
set -euo pipefail

# Steering inbox: the lead→crewmate channel. The payload goes to a durable
# file; the herdr prompt carries only a constant doorbell, so a lost prompt
# loses nothing and ringing again is free (a duplicate doorbell is a no-op —
# the crewmate finds the inbox empty and ignores it).
#
# Usage:
#   inbox-send.sh <run-dir> <task-id> <agent-name> <message...>   write + ring
#   inbox-send.sh --ring <run-dir> <task-id> <agent-name>         ring only (re-ring)
#
# Layout: <run-dir>/task-<id>.inbox/NNN.msg — the crewmate acts on a message,
# then mv's it to handled/ (the mv IS the acknowledgement). Sequence numbers
# scan the inbox root AND handled/, so a number is never reused. Single-writer
# by design: only the lead calls this.

ring_only=0
if [[ "${1:-}" == "--ring" ]]; then ring_only=1; shift; fi

run_dir="${1:?run-dir required}"; task_id="${2:?task-id required}"; agent="${3:?agent-name required}"
shift 3

inbox="$run_dir/task-$task_id.inbox"
doorbell="bd-execute: you have mail — read each unhandled message in $inbox oldest-first, act on it, then mv it into $inbox/handled/. An empty inbox means a duplicate ring; ignore it and carry on."

if [[ "$ring_only" -eq 0 ]]; then
  [[ $# -gt 0 ]] || { echo "message required" >&2; exit 2; }
  msg="$*"
  mkdir -p "$inbox/handled"
  last="$(find "$inbox" "$inbox/handled" -maxdepth 1 -name '[0-9]*.msg' -exec basename {} .msg \; 2>/dev/null | sort -n | tail -1 || true)"
  next="$(printf '%03d' $((10#${last:-0} + 1)))"
  tmp="$(mktemp "$inbox/.tmp.XXXXXX")"
  {
    echo "at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "--"
    printf '%s\n' "$msg"
  } > "$tmp"
  mv -f "$tmp" "$inbox/$next.msg"
  echo "WROTE $inbox/$next.msg"
fi

if herdr agent prompt "$agent" "$doorbell" >/dev/null 2>&1; then
  echo "RANG $agent"
else
  echo "RING FAILED for $agent — the message is durable; re-ring with: $0 --ring $run_dir $task_id $agent" >&2
  exit 1
fi

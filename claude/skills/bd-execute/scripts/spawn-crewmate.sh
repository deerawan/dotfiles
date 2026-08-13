#!/usr/bin/env bash
set -euo pipefail

# Spawn one bd-execute crewmate:
#   stax worktree lane (branch stacked on parent) -> herdr tab in the lead's
#   workspace -> claude started in the pane -> brief delivered via herdr agent prompt.
#
# Usage:
#   spawn-crewmate.sh <repo-root> <run-dir> <task-id> <branch> <parent-branch> \
#                     <workspace-id> <lead-name> [--yolo]
#
# <lead-name> is the lead agent's herdr NAME (set via `herdr agent rename` in preflight) —
# names are layout-independent agent addresses; pane ids go stale if panes move.
#
# Run serially per task (never in parallel) — stax/git worktree creation races on .git.
# DRY_RUN=1 prints what would happen without touching anything.

repo_root="${1:?repo-root required}"; run_dir="${2:?run-dir required}"
task_id="${3:?task-id required}"; branch="${4:?branch required}"
parent="${5:?parent-branch required}"; workspace_id="${6:?workspace-id required}"
lead_name="${7:?lead-name required}"
yolo=0; [[ "${8:-}" == "--yolo" ]] && yolo=1

brief_file="$run_dir/task-$task_id.brief.md"
initial_prompt="You are a bd-execute crewmate. Your complete order is in ${brief_file} — read it now and follow it exactly. Do not act on anything outside that brief."

tab_label="task-${task_id}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "BRANCH=${branch} PARENT=${parent} TAB_LABEL=${tab_label} WORKSPACE=${workspace_id}"
  echo "BRIEF=${brief_file}"
  exit 0
fi

command -v stax  >/dev/null || { echo "stax not found"  >&2; exit 1; }
command -v herdr >/dev/null || { echo "herdr not found" >&2; exit 1; }
command -v jq    >/dev/null || { echo "jq not found"    >&2; exit 1; }
[[ -f "$brief_file" ]] || { echo "brief file missing: $brief_file (write it before spawning)" >&2; exit 1; }

cd "$repo_root"

# 1. Branch + worktree as a stax lane (participates in stax status / worktree restack).
if ! git show-ref --quiet "refs/heads/$branch"; then
  stax worktree create "$branch" --from "$parent" --no-verify </dev/null >/dev/null
fi
wt_path="$(stax worktree path "$branch")"
[[ -d "$wt_path" ]] || { echo "worktree path not found for $branch" >&2; exit 1; }

# 2. herdr tab in the lead's workspace, cwd = the worktree.
tab_json="$(herdr tab create --workspace "$workspace_id" --cwd "$wt_path" --label "$tab_label" --no-focus)"
pane_id="$(echo "$tab_json" | jq -r '.result.root_pane.pane_id')"
tab_id="$(echo "$tab_json" | jq -r '.result.tab.tab_id')"
[[ -n "$pane_id" && "$pane_id" != "null" ]] || { echo "failed to create tab: $tab_json" >&2; exit 1; }

# 3. Start claude in the pane. The agent NAME is the stable address (layout-independent:
#    survives pane moves/splits, unlike pane ids; tab ids are not valid agent targets).
#    Prefix with the run slug so task ids never collide across runs — but herdr caps names
#    at 32 chars, so truncate the slug part deterministically and disambiguate with a short
#    hash of the full slug. The task id always survives intact.
run_slug="$(basename "$run_dir")"
suffix="task-${task_id}"
agent_name="${run_slug}-${suffix}"
if (( ${#agent_name} > 32 )); then
  slug_hash="$(printf '%s' "$run_slug" | shasum | cut -c1-4)"
  keep=$(( 32 - ${#suffix} - ${#slug_hash} - 2 ))   # two joining dashes
  (( keep >= 1 )) || { echo "task id too long for a 32-char agent name: $task_id" >&2; exit 1; }
  agent_name="$(printf '%s' "$run_slug" | cut -c1-"$keep")-${slug_hash}-${suffix}"
fi

# --add-dir makes the run dir a working directory for the crewmate, so reading its brief and
# writing status/pr.md files there never hits a permission prompt (the structural stall:
# the brief lives outside the worktree).
agent_args=(--permission-mode auto --add-dir "$run_dir")
[[ "$yolo" == "1" ]] && agent_args=(--dangerously-skip-permissions --add-dir "$run_dir")

# The tab's pane needs a moment to reach an interactive shell prompt; starting the agent
# too early fails with agent_pane_busy. Retry on that error only.
started=0
for _ in $(seq 1 20); do
  if out="$(herdr agent start "$agent_name" --kind claude --pane "$pane_id" -- "${agent_args[@]}" 2>&1)"; then
    started=1; break
  fi
  if [[ "$out" == *agent_pane_busy* || "$out" == *pane_busy* ]]; then
    sleep 1
  else
    echo "agent start failed for $task_id: $out" >&2; exit 1
  fi
done
[[ "$started" == "1" ]] || { echo "agent start timed out (pane never became ready) for $task_id" >&2; exit 1; }

# 4. Record the crewmate in the roster. `name` is the address for all herdr agent commands;
#    pane/tab ids are kept only for tab-level ops (tab close / focus).
roster="$run_dir/crew.json"
tmp="$(mktemp "$run_dir/.crew.XXXXXX")"
existing='{}'
[[ -f "$roster" ]] && existing="$(cat "$roster")"
echo "$existing" | jq \
  --arg id "$task_id" --arg name "$agent_name" --arg pane "$pane_id" --arg tab "$tab_id" \
  --arg branch "$branch" --arg parent "$parent" --arg wt "$wt_path" \
  --arg lead "$lead_name" --arg spawned "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '.lead = $lead
   | .[$id] = {name: $name, pane: $pane, tab: $tab, branch: $branch, parent: $parent,
               worktree: $wt, spawned_at: $spawned}' > "$tmp"
mv -f "$tmp" "$roster"

# 5. Mark running, then deliver the order (addressed by name).
"$(dirname "$0")/write-status.sh" "$run_dir" "$task_id" running --branch "$branch" --base "$parent" >/dev/null
herdr agent prompt "$agent_name" "$initial_prompt" >/dev/null

echo "SPAWNED task=$task_id agent=$agent_name pane=$pane_id tab=$tab_id branch=$branch parent=$parent worktree=$wt_path"

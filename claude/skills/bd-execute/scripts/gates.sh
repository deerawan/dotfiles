#!/usr/bin/env bash
# Sourced by write-status.sh and crew-status.sh, or run as gates.sh <run-dir> <task-id>. Prints "review:<ok|missing> testing:<ok|missing> pr:<ok|missing|no-demo>".

demo_section_filled() {
  awk '
    /^#+ / { in_demo = (tolower($0) ~ /demo|screenshot|evidence/); if (in_demo) seen = 1; next }
    !in_demo { next }
    { line = $0 }
    in_comment { if (sub(/.*-->/, "", line)) in_comment = 0; else next }
    { gsub(/<!--.*-->/, "", line) }
    sub(/<!--.*/, "", line) { in_comment = 1 }
    line ~ /[^[:space:]]/ { filled = 1 }
    END { exit (seen && !filled) }
  ' "$1"
}

gate_results() {
  local run_dir="$1" id="$2" review=missing testing=missing pr=missing
  grep -q '^verdict: *approve' "$run_dir/task-$id.review.md" 2>/dev/null && review=ok
  [[ -s "$run_dir/task-$id.testing.md" ]] && testing=ok
  if [[ -s "$run_dir/task-$id.pr.md" ]]; then
    if demo_section_filled "$run_dir/task-$id.pr.md"; then pr=ok; else pr=no-demo; fi
  fi
  echo "review:$review testing:$testing pr:$pr"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  result="$(gate_results "${1:?run-dir required}" "${2:?task-id required}")"
  echo "$result"
  [[ "$result" != *missing* && "$result" != *no-demo* ]]
fi

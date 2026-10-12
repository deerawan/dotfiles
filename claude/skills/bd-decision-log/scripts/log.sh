#!/usr/bin/env bash
# Usage: log.sh <logfile> <phase> <decision> <why> <evidence> <result>
set -euo pipefail

if [ "$#" -ne 6 ]; then
	printf 'usage: log.sh <logfile> <phase> <decision> <why> <evidence> <result>\n' >&2
	exit 1
fi

logfile="$1"
shift
mkdir -p "$(dirname "$logfile")"

if [ ! -s "$logfile" ]; then
	printf 'ts\tphase\tdecision\twhy\tevidence\tresult\n' >> "$logfile"
fi

single_line_spreadsheet_safe() {
	local v
	v=$(printf '%s' "$1" | tr '\t\n\r' '   ')
	case "$v" in
		=*|+*|-*|@*|\"*) printf "'%s" "$v" ;;
		*) printf '%s' "$v" ;;
	esac
}

cells=()
for v in "$@"; do cells+=("$(single_line_spreadsheet_safe "$v")"); done
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${cells[@]}" >> "$logfile"

#!/bin/bash
set -f

# Read JSON input from stdin
input=$(cat)

if [ -z "$input" ]; then
    printf "Claude"
    exit 0
fi

# ── ANSI Colors (for rate limit bars & thinking indicator) ──
blue='\033[38;2;0;153;255m'
orange='\033[38;2;255;176;85m'
green='\033[38;2;0;175;80m'
cyan='\033[38;2;86;182;194m'
red='\033[38;2;255;85;85m'
yellow='\033[38;2;230;200;0m'
white='\033[38;2;220;220;220m'
magenta='\033[38;2;180;140;255m'
dim='\033[2m'
reset='\033[0m'

# ── Helpers ─────────────────────────────────────────────
color_for_pct() {
    local pct=$1
    if [ "$pct" -ge 90 ]; then printf "$red"
    elif [ "$pct" -ge 70 ]; then printf "$yellow"
    elif [ "$pct" -ge 50 ]; then printf "$orange"
    else printf "$green"
    fi
}

build_bar() {
    local pct=$1
    local width=$2
    [ "$pct" -lt 0 ] 2>/dev/null && pct=0
    [ "$pct" -gt 100 ] 2>/dev/null && pct=100

    local filled=$(( pct * width / 100 ))
    local empty=$(( width - filled ))
    local bar_color
    bar_color=$(color_for_pct "$pct")

    local filled_str="" empty_str=""
    for ((i=0; i<filled; i++)); do filled_str+="●"; done
    for ((i=0; i<empty; i++)); do empty_str+="○"; done

    printf "${bar_color}${filled_str}${dim}${empty_str}${reset}"
}

format_epoch() {
    local epoch="$1"
    local style="$2"
    [ -z "$epoch" ] || [ "$epoch" = "null" ] && return

    case "$style" in
        time)
            date -j -r "$epoch" +"%l:%M%p" 2>/dev/null | sed 's/^ //; s/\.//g' | tr '[:upper:]' '[:lower:]' || \
            date -d "@$epoch" +"%l:%M%P" 2>/dev/null | sed 's/^ //; s/\.//g'
            ;;
        datetime)
            date -j -r "$epoch" +"%b %-d, %l:%M%p" 2>/dev/null | sed 's/  / /g; s/^ //; s/\.//g' | tr '[:upper:]' '[:lower:]' || \
            date -d "@$epoch" +"%b %-d, %l:%M%P" 2>/dev/null | sed 's/  / /g; s/^ //; s/\.//g'
            ;;
    esac
}

# ── Extract JSON data for line 1 ───────────────────────
model=$(echo "$input" | jq -r '.model.display_name // empty')
context_used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
project_dir=$(echo "$input" | jq -r '.cwd // empty' | xargs basename 2>/dev/null)
branch=$(git --no-optional-locks rev-parse --abbrev-ref HEAD 2>/dev/null)

# Check thinking mode
thinking_on=false
settings_path="$HOME/.claude/settings.json"
if [ -f "$settings_path" ]; then
    thinking_val=$(jq -r '.alwaysThinkingEnabled // false' "$settings_path" 2>/dev/null)
    [ "$thinking_val" = "true" ] && thinking_on=true
fi

# ── LINE 1: Existing emoji style + thinking indicator ───
status=""

if [ -n "$model" ]; then
    status="🤖 $model"
fi

if [ -n "$context_used" ]; then
    [ -n "$status" ] && status="$status | " || status=""
    status="${status}📊 ${context_used}%"
fi

if [ -n "$project_dir" ]; then
    [ -n "$status" ] && status="$status | " || status=""
    status="${status}📁 $project_dir"
fi

if [ -n "$branch" ]; then
    [ -n "$status" ] && status="$status | " || status=""
    status="${status}🌿 $branch"
fi

# Append thinking indicator (colored via ANSI)
if $thinking_on; then
    status="${status} | ${magenta}◐ thinking${reset}"
else
    status="${status} | ${dim}◑ thinking${reset}"
fi

# ── Rate limit lines (from stdin JSON) ─────────────────
rate_lines=""

five_hour_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
seven_day_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')

if [ -n "$five_hour_pct" ] || [ -n "$seven_day_pct" ]; then
    bar_width=10

    if [ -n "$five_hour_pct" ]; then
        five_hour_pct=$(printf "%.0f" "$five_hour_pct")
        five_hour_reset_epoch=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
        five_hour_reset=$(format_epoch "$five_hour_reset_epoch" "time")
        five_hour_bar=$(build_bar "$five_hour_pct" "$bar_width")
        five_hour_pct_color=$(color_for_pct "$five_hour_pct")
        five_hour_pct_fmt=$(printf "%3d" "$five_hour_pct")

        rate_lines+="${white}current${reset} ${five_hour_bar} ${five_hour_pct_color}${five_hour_pct_fmt}%${reset} ${dim}⟳${reset} ${white}${five_hour_reset}${reset}"
    fi

    if [ -n "$seven_day_pct" ]; then
        seven_day_pct=$(printf "%.0f" "$seven_day_pct")
        seven_day_reset_epoch=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')
        seven_day_reset=$(format_epoch "$seven_day_reset_epoch" "datetime")
        seven_day_bar=$(build_bar "$seven_day_pct" "$bar_width")
        seven_day_pct_color=$(color_for_pct "$seven_day_pct")
        seven_day_pct_fmt=$(printf "%3d" "$seven_day_pct")

        [ -n "$rate_lines" ] && rate_lines+="\n\n"
        rate_lines+="${white}weekly${reset}  ${seven_day_bar} ${seven_day_pct_color}${seven_day_pct_fmt}%${reset} ${dim}⟳${reset} ${white}${seven_day_reset}${reset}"
    fi
fi

# ── Output ──────────────────────────────────────────────
printf "%b" "$status"
[ -n "$rate_lines" ] && printf "\n\n%b" "$rate_lines"

exit 0

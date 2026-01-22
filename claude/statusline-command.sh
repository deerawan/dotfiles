#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Extract model display name
model=$(echo "$input" | jq -r '.model.display_name // empty')

# Extract context usage percentage
context_used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Extract project directory (folder name only)
project_dir=$(echo "$input" | jq -r '.cwd // empty' | xargs basename 2>/dev/null)

# Get current git branch (if in a git repo)
branch=$(git --no-optional-locks rev-parse --abbrev-ref HEAD 2>/dev/null)

# Build the status line
status=""

# Add model
if [ -n "$model" ]; then
    status="🤖 $model"
fi

# Add context percentage
if [ -n "$context_used" ]; then
    if [ -n "$status" ]; then
        status="$status | 📊 ${context_used}%"
    else
        status="📊 ${context_used}%"
    fi
fi

# Add project directory
if [ -n "$project_dir" ]; then
    if [ -n "$status" ]; then
        status="$status | 📁 $project_dir"
    else
        status="📁 $project_dir"
    fi
fi

# Add git branch
if [ -n "$branch" ]; then
    if [ -n "$status" ]; then
        status="$status | 🌿 $branch"
    else
        status="🌿 $branch"
    fi
fi

echo "$status"

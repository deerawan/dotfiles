#!/usr/bin/env python3
import json
import re
import sys

PROTECTED_PATTERNS = [
    (r"\.env($|\.)", "BLOCKED: .env files are protected"),
    (r"credentials", "BLOCKED: Credential files are protected"),
    (r"secrets?\.(json|ya?ml|txt)", "BLOCKED: Secret files are protected"),
    (r"\.pem$", "BLOCKED: PEM files are protected"),
    (r"\.key$", "BLOCKED: Key files are protected"),
    (r"id_rsa", "BLOCKED: SSH keys are protected"),
    (r"id_ed25519", "BLOCKED: SSH keys are protected"),
    (r"/\.aws/", "BLOCKED: AWS config is protected"),
    (r"/\.ssh/", "BLOCKED: SSH directory is protected"),
    (r"pulumi\.[^/]*prod[^/]*\.ya?ml", "BLOCKED: Production Pulumi config"),
]

def validate_file_path(file_path, tool_name):
    for pattern, message in PROTECTED_PATTERNS:
        if re.search(pattern, file_path, re.IGNORECASE):
            return False, f"{message} (attempted: {tool_name})"
    return True, None

try:
    input_data = json.load(sys.stdin)
    tool_name = input_data.get('tool_name', '')
    file_path = input_data.get('tool_input', {}).get('file_path', '')

    is_safe, reason = validate_file_path(file_path, tool_name)

    if not is_safe:
        print(reason, file=sys.stderr)
        sys.exit(2)
except Exception as e:
    print(f"Hook validation error: {e}", file=sys.stderr)
    sys.exit(0)

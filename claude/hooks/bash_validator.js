#!/usr/bin/env node
const DANGEROUS_PATTERNS = [
  // File Destruction - block rm on root or system directories, allow project paths
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/\s*$/, 'BLOCKED: rm targeting root /'],
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(etc|usr|var|bin|sbin|lib|boot|dev|proc|sys|opt|srv|root)\b/, 'BLOCKED: rm targeting system directory'],
  [/\brm\s+-rf\s+[~*]/, 'BLOCKED: rm -rf on home or wildcard'],
  [/\brm\s+-rf\s+\.\s*$/, 'BLOCKED: rm -rf on current directory'],
  // Privilege Escalation
  [/^\s*sudo\s+/, 'BLOCKED: sudo commands not allowed'],
  [/^\s*su\s+-/, 'BLOCKED: su - not allowed'],
  [/\bchmod\s+777/, 'BLOCKED: chmod 777 is dangerous'],
  [/\bchown\s+-R\s+.*\s+\//, 'BLOCKED: recursive chown on root'],
  // Disk Operations
  [/\bdd\s+if=/, 'BLOCKED: dd can destroy filesystems'],
  [/\bmkfs[\s.]/, 'BLOCKED: mkfs can format drives'],
  [/\bfdisk\s+\/dev\//, 'BLOCKED: fdisk can corrupt partitions'],
  [/\bdiskutil\s+(eraseDisk|partitionDisk|eraseVolume)/, 'BLOCKED: diskutil can format drives'],
  // Fork Bombs & Resource Exhaustion
  [/:\s*\(\s*\)\s*\{/, 'BLOCKED: Fork bomb detected'],
  [/while\s+true\s*;?\s*do/, 'BLOCKED: Infinite loop detected'],
  // Remote Code Execution
  [/curl\s+.*\|\s*(ba)?sh/, 'BLOCKED: Piping curl to shell'],
  [/wget\s+.*\|\s*(ba)?sh/, 'BLOCKED: Piping wget to shell'],
  [/curl\s+.*-o\s+\/(?!dev\/null\b)/, 'BLOCKED: curl writing to root'],
  // Production Database
  [/psql\s+.*(-h|--host)\s*[=\s]*\S*prod/i, 'BLOCKED: Production database access'],
  [/mysql\s+.*(-h|--host)\s*[=\s]*\S*prod/i, 'BLOCKED: Production database access'],
  [/flyway\s+clean/, 'BLOCKED: flyway clean wipes database'],
  [/DROP\s+(DATABASE|TABLE|SCHEMA)/i, 'BLOCKED: DROP statements'],
  [/TRUNCATE\s+TABLE/i, 'BLOCKED: TRUNCATE statements'],
  [/DELETE\s+FROM\s+\S+\s*(;|$)/i, 'BLOCKED: DELETE without WHERE clause'],
  // Git Dangerous
  [/git\s+push\s+.*--force.*\b(main|master)\b/, 'BLOCKED: force push to protected branch'],
  [/git\s+push\s+-f\s+.*\b(main|master)\b/, 'BLOCKED: force push to protected branch'],
  [/git\s+clean\s+-fd/, 'BLOCKED: git clean removes files'],
  // Infrastructure Destruction
  [/pulumi\s+destroy/, 'BLOCKED: pulumi destroy'],
  [/terraform\s+destroy/, 'BLOCKED: terraform destroy'],
  [/aws\s+.*\bdelete-/, 'BLOCKED: AWS delete operations'],
  [/aws\s+.*\bterminate-/, 'BLOCKED: AWS terminate operations'],
  [/aws\s+s3\s+rb/, 'BLOCKED: S3 bucket removal'],
  [/aws\s+s3\s+rm\s+.*--recursive/, 'BLOCKED: S3 recursive delete'],
  // Secrets Reading via Bash
  [/\b(cat|head|tail|less|more|bat)\s+.*credentials/, 'BLOCKED: Reading credentials'],
  [/\b(cat|head|tail|less|more|bat)\s+.*id_rsa/, 'BLOCKED: Reading SSH keys'],
  [/\b(cat|head|tail|less|more|bat)\s+.*\.pem/, 'BLOCKED: Reading PEM files'],
  [/\b(cat|head|tail|less|more|bat)\s+.*\.key/, 'BLOCKED: Reading key files'],
  [/\b(cat|head|tail|less|more|bat)\s+.*\/\.aws\//, 'BLOCKED: Reading AWS config'],
  // Package Manager Risks
  [/npm\s+publish/, 'BLOCKED: npm publish'],
  [/npm\s+unpublish/, 'BLOCKED: npm unpublish'],
];

function validateCommand(command) {
  for (const [pattern, message] of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: message };
    }
  }
  return { safe: true };
}

try {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    const data = JSON.parse(input);
    const command = data?.tool_input?.command ?? '';
    const result = validateCommand(command);

    if (!result.safe) {
      process.stderr.write(result.reason + '\n');
      process.exit(2);
    }
  });
} catch (e) {
  process.stderr.write(`Hook validation error: ${e.message}\n`);
  process.exit(0); // Allow on error to avoid blocking legitimate commands
}

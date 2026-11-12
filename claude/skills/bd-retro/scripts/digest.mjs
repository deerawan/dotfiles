#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const EXCERPT_CHARS = 300;
const REVIEW_EXCERPT_CHARS = 1200;
const DIGEST_CHAR_BUDGET = 120_000;
const RETRY_WINDOW = 3;
const RETRY_SIMILARITY = 0.6;
const CLUSTER_MIN = 3;
const HEAVY_RESULT_CHARS = 25_000;
const REPEAT_READ_MIN = 3;
const RULE_MIN_CHARS = 30;
const DEEP_THRESHOLDS = {
  review_comment: 3,
  correction: 3,
  retried_failure: 5,
  rule_hit: 1,
  heavy_result: 5,
};
const DEEP_MIN_SIGNALS = 15;
const NOT_SIGNALS = new Set(['ask_answer']);

const CORRECTION_OPENERS =
  /^\s*(oh,?\s+)?(no\b|nope|don'?t|do not|stop|wrong|actually|that'?s not|it'?s not|not what|i mean|i meant|why did you|instead|undo|revert|wait)/i;
const NOT_A_PROMPT =
  /^(<command-|<local-command|<task-notification|This session is being continued|Another Claude session sent)/;
const HOOK_BLOCK = /hook error:.*BLOCKED/i;
const USER_REJECTED = /The user doesn't want to proceed with this tool use/;
const INTERRUPTED = /\[Request interrupted by user/;
const REVIEW_FETCH = /gh (api [^|;&]*(comments|reviews)|pr view[^|;&]*(comments|reviews))/;
const REVIEW_LINK = /github\.com\/[^\s]+\/pull\/\d+#(discussion_r|pullrequestreview-)\d+/;
const REVIEW_LEAD = /^\s*(nit|suggestion|question|issue|praise|blocking)\s*:/im;
const FILE_LINE = /\b[\w./-]+\.\w+:\d+\b/;
const TICKET_IN_BRANCH = /(?:^|\/)([a-z]{2,5}-\d+)/i;
const PR_IN_COMMAND = [
  /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g,
  /\bgh api\s+\/?repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)/g,
  /\bgh pr (?:view|checks|diff|comment|review|edit|ready|merge|checkout)\s+()(\d+)\b/g,
];
const BASH_READ = /(?:^|[;&|]\s*)(?:cat|sed -n '[^']*')\s+([^\s|;&"'<>$][^\s|;&"'<>]*)/;

const REDACTIONS = [
  [/(:\/\/[^\s:/@]+:)[^\s@]+@/g, '$1<redacted>@'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<aws-key>'],
  [/\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/g, '<gh-token>'],
  [/\bsk-[A-Za-z0-9-_]{20,}\b/g, '<api-key>'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '<slack-token>'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '<jwt>'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/g, 'Bearer <token>'],
  [/\b(sdk|api|mob)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<ld-key>'],
  [/\bATATT[A-Za-z0-9_=-]{20,}/g, '<atlassian-token>'],
  [
    /\b([A-Za-z0-9_-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)[A-Za-z0-9_-]*)(["'\s:=]+)[^\s"']{6,}/gi,
    '$1$2<redacted>',
  ],
];

export const redact = (text) =>
  REDACTIONS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);

export const excerpt = (text, max = EXCERPT_CHARS) => {
  const flat = redact(String(text).slice(0, max * 2))
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

const firstLine = (text) =>
  String(text)
    .split('\n')
    .find((line) => line.trim())
    ?.trim() ?? '';

const textOf = (content) =>
  typeof content === 'string'
    ? content
    : (content ?? []).map((block) => (block.type === 'text' ? block.text : '')).join(' ');

export const isPastedReview = (text) =>
  REVIEW_LINK.test(text) || (REVIEW_LEAD.test(text) && FILE_LINE.test(text));

export const prsFromCommand = (command) =>
  PR_IN_COMMAND.flatMap((pattern) =>
    [...String(command).matchAll(pattern)].map(([, repo, number]) => `${repo}#${number}`)
  );

export const ticketFromBranch = (branch) =>
  branch?.match(TICKET_IN_BRANCH)?.[1]?.toUpperCase() ?? null;

const normalizeRule = (text) =>
  text
    .toLowerCase()
    .replace(/[\s*`_"']+/g, ' ')
    .trim();

export const quotesRule = (text, rules) => {
  const haystack = normalizeRule(text);
  return rules.find((rule) => haystack.includes(rule.normalized)) ?? null;
};

export function loadRuleLines(repoRoot) {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '*AGENTS.md'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
  return files.flatMap((file) =>
    readFileSync(join(repoRoot, file), 'utf8')
      .split('\n')
      .map((raw, index) => {
        const text = raw.replace(/^\s*([-*]|\d+\.)\s+/, '').trim();
        return { source: `${file}:${index + 1}`, text, normalized: normalizeRule(text) };
      })
      .filter(({ text }) => text.length >= RULE_MIN_CHARS && !/^(#|\||```)/.test(text))
  );
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((raw, index) => {
      try {
        return [{ record: JSON.parse(raw), lineNo: index + 1 }];
      } catch {
        return [];
      }
    });
}

function usageOf(records) {
  const byMessage = new Map();
  for (const { record, lineNo } of records) {
    if (record.type === 'assistant' && record.message?.usage) {
      byMessage.set(record.message.id ?? lineNo, record.message.usage);
    }
  }
  return [...byMessage.values()].reduce(
    (acc, usage) => ({
      input: acc.input + (usage.input_tokens ?? 0),
      cacheWrite: acc.cacheWrite + (usage.cache_creation_input_tokens ?? 0),
      cacheRead: acc.cacheRead + (usage.cache_read_input_tokens ?? 0),
      output: acc.output + (usage.output_tokens ?? 0),
      turns: acc.turns + 1,
    }),
    { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, turns: 0 }
  );
}

function subagentSpend(transcriptPath) {
  const dir = join(transcriptPath.replace(/\.jsonl$/, ''), 'subagents');
  if (!existsSync(dir)) return { count: 0, input: 0 };
  const files = readdirSync(dir).filter((name) => name.endsWith('.jsonl'));
  const input = files.reduce((sum, name) => {
    const usage = usageOf(readJsonl(join(dir, name)));
    return sum + usage.input + usage.cacheWrite + usage.cacheRead;
  }, 0);
  return { count: files.length, input };
}

const tokensOf = (call) =>
  (call.tokens ??= new Set(call.input.split(/[^A-Za-z0-9_./-]+/).filter(Boolean)));

const isRetryOf = (later, earlier) => {
  if (later.name !== earlier.name || later.messageId === earlier.messageId) return false;
  const left = tokensOf(later);
  const right = tokensOf(earlier);
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(1, left.size, right.size) >= RETRY_SIMILARITY;
};

const readPath = (call) =>
  call.name === 'Read'
    ? call.args.file_path ?? null
    : call.name === 'Bash'
    ? String(call.args.command ?? '').match(BASH_READ)?.[1] ?? null
    : null;

export function addEconomy(events, toolCalls) {
  const reads = new Map();
  for (const call of toolCalls) {
    if (call.resultChars > HEAVY_RESULT_CHARS) {
      events.push({
        kind: 'heavy_result',
        line: call.line,
        text: `${call.name} returned ${call.resultChars} chars. Input: ${excerpt(call.input, 160)}`,
      });
    }
    const path = readPath(call);
    if (!path) continue;
    const seen = reads.get(path) ?? { line: call.line, count: 0, tools: new Set() };
    seen.count += 1;
    seen.tools.add(call.name);
    reads.set(path, seen);
  }
  for (const [path, { line, count, tools }] of reads) {
    if (count < REPEAT_READ_MIN) continue;
    events.push({
      kind: 'repeat_read',
      line,
      text: `${count}× read ${excerpt(path, 160)} via ${[...tools].join(', ')}`,
    });
  }
}

function addFailures(events, toolCalls) {
  const unretried = new Map();
  toolCalls.forEach((call, index) => {
    if (!call.failed) return;
    const error = excerpt(firstLine(call.failed.text), 200);
    const retry = toolCalls
      .slice(index + 1, index + 1 + RETRY_WINDOW)
      .find((c) => isRetryOf(c, call));
    if (retry) {
      events.push({
        kind: 'retried_failure',
        line: call.failed.line,
        text: `${call.name} failed, retried at L${retry.line}: ${error} Input: ${excerpt(
          call.input,
          160
        )}`,
      });
      return;
    }
    const group = unretried.get(`${call.name} ${error}`) ?? { call, error, count: 0 };
    group.count += 1;
    unretried.set(`${call.name} ${error}`, group);
  });
  for (const { call, error, count } of unretried.values()) {
    events.push({
      kind: 'failed_command',
      line: call.failed.line,
      text: `${count}× ${call.name} failed: ${error} Input: ${excerpt(call.input, 160)}`,
    });
  }
}

export function addRetryClusters(events, toolCalls) {
  let run = [];
  const flush = () => {
    if (run.length >= CLUSTER_MIN && run.some((c) => c.failed)) {
      events.push({
        kind: 'retry_cluster',
        line: run[0].line,
        text: `${run.length} near-identical ${run[0].name} calls (L${run[0].line}-L${
          run.at(-1).line
        }). First: ${excerpt(run[0].input, 160)}`,
      });
    }
    run = [];
  };
  for (const call of toolCalls) {
    if (!run.length || isRetryOf(call, run.at(-1))) run.push(call);
    else {
      flush();
      run = [call];
    }
  }
  flush();
}

function countNewReviewComments(text, seen) {
  const bodies = text.match(/"body"\s*:\s*"[^"]{20,}/g) ?? [text];
  const fresh = bodies.map((body) => body.slice(0, 120)).filter((key) => !seen.has(key));
  fresh.forEach((key) => seen.add(key));
  return fresh.length;
}

function readSession(path, rulesFor) {
  const records = readJsonl(path).filter(({ record }) => !record.isSidechain);
  const events = [];
  const toolCalls = [];
  const callsById = new Map();
  const seenReviewBodies = new Set();
  const hookErrors = new Map();
  const meta = {
    path,
    branch: null,
    prs: new Set(),
    skills: new Set(),
    started: null,
    ended: null,
    request: null,
  };
  const add = (kind, line, text, weight = 1) => events.push({ kind, line, text, weight });

  for (const { record, lineNo } of records) {
    if (record.timestamp) {
      meta.started ??= record.timestamp;
      meta.ended = record.timestamp;
    }
    if (record.gitBranch && record.gitBranch !== 'HEAD') meta.branch = record.gitBranch;
    if (record.type === 'pr-link') meta.prs.add(record.prUrl);
    if (record.type === 'attachment' && record.attachment?.type === 'hook_non_blocking_error') {
      const { hookName, stderr } = record.attachment;
      const key = `${hookName}: ${excerpt(firstLine(stderr ?? ''), 200)}`;
      const seen = hookErrors.get(key) ?? { line: lineNo, count: 0 };
      seen.count += 1;
      hookErrors.set(key, seen);
    }

    if (record.type === 'assistant') {
      for (const block of record.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        const args = block.input ?? {};
        const call = {
          name: block.name,
          args,
          input: JSON.stringify(args),
          line: lineNo,
          messageId: record.message?.id ?? lineNo,
        };
        toolCalls.push(call);
        callsById.set(block.id, call);
        if (block.name === 'Skill') meta.skills.add(args.skill);
        if (block.name === 'Bash') prsFromCommand(args.command).forEach((pr) => meta.prs.add(pr));
      }
      continue;
    }
    if (record.type !== 'user') continue;

    const typedByHuman = record.origin ? record.origin.kind === 'human' : !record.isMeta;
    const addPrompt = (text) => {
      if (!typedByHuman || NOT_A_PROMPT.test(text)) return;
      meta.request ??= excerpt(text);
      if (isPastedReview(text))
        return add('review_comment', lineNo, excerpt(text, REVIEW_EXCERPT_CHARS));
      if (!CORRECTION_OPENERS.test(text)) return;
      add('correction', lineNo, excerpt(text));
      const quoted = quotesRule(text, rulesFor());
      if (quoted)
        add('rule_hit', lineNo, `Correction quotes ${quoted.source}: ${excerpt(quoted.text, 200)}`);
    };

    const content = record.message?.content;
    if (typeof content === 'string') {
      addPrompt(content);
      continue;
    }
    for (const block of content ?? []) {
      if (block.type === 'text') {
        if (INTERRUPTED.test(block.text)) add('correction', lineNo, 'User interrupted the turn.');
        else addPrompt(block.text);
        continue;
      }
      if (block.type !== 'tool_result') continue;
      const call = callsById.get(block.tool_use_id);
      const resultText = textOf(block.content);
      if (call) call.resultChars = resultText.length;

      if (call?.name === 'AskUserQuestion' && !block.is_error)
        add('ask_answer', lineNo, excerpt(resultText));
      if (call?.name === 'Bash' && REVIEW_FETCH.test(call.input) && resultText.length > 200) {
        const weight = countNewReviewComments(resultText, seenReviewBodies);
        if (weight)
          add('review_comment', lineNo, excerpt(resultText, REVIEW_EXCERPT_CHARS), weight);
      }
      if (!block.is_error) continue;
      if (USER_REJECTED.test(resultText)) {
        add(
          'correction',
          lineNo,
          `User rejected ${call?.name ?? 'a tool call'}: ${excerpt(call?.input ?? '', 160)}`
        );
      } else if (HOOK_BLOCK.test(resultText)) {
        add(
          'rule_hit',
          lineNo,
          `${call?.name ?? 'tool'} blocked by hook: ${excerpt(resultText, 200)}`
        );
      } else if (call) {
        call.failed = { line: lineNo, text: resultText };
      }
    }
  }
  for (const [key, { line, count }] of hookErrors) add('hook_error', line, `${count}× ${key}`);
  meta.usage = usageOf(records);
  meta.subagents = subagentSpend(path);
  return { meta, events, toolCalls };
}

export function decideMode(counts, forceDeep) {
  if (forceDeep) return { mode: 'deep', reasons: ['--deep flag'] };
  const describe = ([kind, count]) => `${count} ${kind}`;
  const signals = Object.entries(counts).filter(
    ([kind, count]) => count > 0 && !NOT_SIGNALS.has(kind)
  );
  if (!signals.length) return { mode: 'none', reasons: [] };
  const total = signals.reduce((sum, [, count]) => sum + count, 0);
  const deep = Object.entries(DEEP_THRESHOLDS).filter(([kind, min]) => counts[kind] >= min);
  if (deep.length && total >= DEEP_MIN_SIGNALS)
    return { mode: 'deep', reasons: deep.map(([kind]) => describe([kind, counts[kind]])) };
  const note = deep.length ? [`${total} signals, deep needs ${DEEP_MIN_SIGNALS}`] : [];
  return { mode: 'single', reasons: [...signals.map(describe), ...note] };
}

const compact = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);

export function render({ meta, events }, decision) {
  const { usage, subagents } = meta;
  const header = [
    '# Session digest',
    '',
    `- transcript: ${meta.path}`,
    `- branch: ${meta.branch ?? 'unknown'}`,
    `- ticket: ${ticketFromBranch(meta.branch) ?? 'none'}`,
    `- request: ${meta.request ?? 'none'}`,
    `- span: ${meta.started} → ${meta.ended}`,
    `- PRs: ${[...meta.prs].join(', ') || 'none'}`,
    `- skills used: ${[...meta.skills].filter(Boolean).join(', ') || 'none'}`,
    `- spend: main in ${compact(usage.input)} · cache write ${compact(
      usage.cacheWrite
    )} · cache read ${compact(usage.cacheRead)} · out ${compact(usage.output)} over ${
      usage.turns
    } turns · ${subagents.count} subagents in ${compact(subagents.input)}`,
    `- mode: ${decision.mode}${decision.reasons.length ? ` (${decision.reasons.join(', ')})` : ''}`,
    '',
    '## Events',
    '',
  ];
  const rows = [...events]
    .sort((a, b) => a.line - b.line)
    .map((event, i) => `- [E${i + 1}] L${event.line} ${event.kind}: ${event.text}`);
  let used = header.join('\n').length + 100 + rows.reduce((sum, row) => sum + row.length + 1, 0);
  let truncated = 0;
  while (used > DIGEST_CHAR_BUDGET && rows.length) {
    used -= rows.pop().length + 1;
    truncated += 1;
  }
  const note = truncated ? [`- (${truncated} later events truncated to fit the budget)`] : [];
  return [...header, ...rows, ...note, ''].join('\n');
}

export const projectTranscriptDir = (repoPath, home) =>
  join(home, '.claude', 'projects', repoPath.replace(/[^A-Za-z0-9]/g, '-'));

export function findTranscript(arg, dirs) {
  const where = `${dirs[0]} or ${dirs.length - 1} other worktree folders`;
  if (arg?.endsWith('.jsonl')) {
    const path = resolve(arg);
    if (!dirs.some((dir) => path.startsWith(`${dir}/`)))
      throw new Error(`Transcript must live in ${where}`);
    return path;
  }
  const [newest] = (arg ? dirs : dirs.slice(0, 1))
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl') && (!arg || name.startsWith(arg)))
        .map((name) => ({ path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    )
    .sort((a, b) => b.mtime - a.mtime);
  if (!newest) throw new Error(`No transcript found in ${arg ? where : dirs[0]}`);
  return newest.path;
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function main() {
  const { values, positionals } = parseArgs({
    options: { deep: { type: 'boolean' }, out: { type: 'string' } },
    allowPositionals: true,
  });
  const current = git(['rev-parse', '--show-toplevel']);
  const worktrees = git(['worktree', 'list', '--porcelain'])
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
    .filter((path) => path !== current);
  const dirs = [
    ...[current, ...worktrees].map((path) => projectTranscriptDir(path, homedir())),
    fileURLToPath(new URL('../evals/scenarios', import.meta.url)),
  ];

  let rules;
  const session = readSession(
    findTranscript(positionals[0], dirs),
    () => (rules ??= loadRuleLines(current))
  );
  addFailures(session.events, session.toolCalls);
  addEconomy(session.events, session.toolCalls);
  addRetryClusters(session.events, session.toolCalls);

  const counts = {};
  for (const { kind, weight } of session.events) counts[kind] = (counts[kind] ?? 0) + (weight ?? 1);
  const decision = decideMode(counts, values.deep);
  const digest = render(session, decision);
  if (values.out) writeFileSync(values.out, digest);
  else process.stdout.write(digest);
  process.stderr.write(
    `${JSON.stringify({
      mode: decision.mode,
      reasons: decision.reasons,
      counts,
      chars: digest.length,
      out: values.out ?? null,
    })}\n`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`digest failed: ${error.message}\n`);
    process.exit(1);
  }
}

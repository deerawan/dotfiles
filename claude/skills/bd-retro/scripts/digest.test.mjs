import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addEconomy,
  addRetryClusters,
  decideMode,
  excerpt,
  findTranscript,
  isPastedReview,
  loadRuleLines,
  projectTranscriptDir,
  prsFromCommand,
  quotesRule,
  redact,
  render,
  ticketFromBranch,
} from './digest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const call = (name, args, line, messageId = `m${line}`, extra = {}) => ({
  name,
  args,
  input: JSON.stringify(args),
  line,
  messageId,
  ...extra,
});
const collect = (add, calls) => {
  const events = [];
  add(events, calls);
  return events;
};

test('projectTranscriptDir encodes the repo path the way Claude Code names project folders', () => {
  assert.equal(
    projectTranscriptDir('/Users/x/monarch-worktrees/tf-1', '/h'),
    '/h/.claude/projects/-Users-x-monarch-worktrees-tf-1'
  );
});

test('findTranscript accepts a sibling worktree transcript and rejects any other path', () => {
  const dirs = ['/h/.claude/projects/-r-main', '/h/.claude/projects/-r-wt'];
  assert.equal(
    findTranscript('/h/.claude/projects/-r-wt/s.jsonl', dirs),
    '/h/.claude/projects/-r-wt/s.jsonl'
  );
  assert.throws(() => findTranscript('/tmp/other/a.jsonl', dirs), /must live in/);
});

test('decideMode picks none, single, or deep and names the signals', () => {
  const cases = [
    [{}, { mode: 'none', reasons: [] }],
    [{ ask_answer: 2 }, { mode: 'none', reasons: [] }],
    [{ hook_error: 2 }, { mode: 'single', reasons: ['2 hook_error'] }],
    [{ failed_command: 1 }, { mode: 'single', reasons: ['1 failed_command'] }],
    [
      { review_comment: 3, correction: 3 },
      { mode: 'single', reasons: ['3 review_comment', '3 correction', '6 signals, deep needs 15'] },
    ],
    [
      { review_comment: 3, failed_command: 12 },
      { mode: 'deep', reasons: ['3 review_comment'] },
    ],
    [
      { heavy_result: 5, retry_cluster: 10 },
      { mode: 'deep', reasons: ['5 heavy_result'] },
    ],
  ];
  for (const [counts, expected] of cases) assert.deepEqual(decideMode(counts, false), expected);
});

test('ticketFromBranch reads a ticket at the start or after a slash only', () => {
  const cases = [
    ['team/tf-719', 'TF-719'],
    ['vp-4409-volume-card', 'VP-4409'],
    ['release-n-train-2026', null],
  ];
  for (const [branch, ticket] of cases) assert.equal(ticketFromBranch(branch), ticket);
});

test('prsFromCommand finds PR numbers in gh commands and PR URLs', () => {
  const cases = [
    ['gh api repos/acme/app/pulls/77/comments', ['acme/app#77']],
    ['gh pr checks 77 --watch', ['#77']],
    ['open https://github.com/acme/app/pull/12#discussion_r1', ['acme/app#12']],
    ['gh run view 701 --log', []],
  ];
  for (const [command, prs] of cases) assert.deepEqual(prsFromCommand(command), prs, command);
});

test('isPastedReview spots review links and reviewer leads with a file location', () => {
  const cases = [
    ['see https://github.com/o/r/pull/12#discussion_r123 please fix', true],
    ['nit: rename this in src/a/b.ts:42', true],
    ['can you review my changes before I push', false],
  ];
  for (const [text, expected] of cases) assert.equal(isPastedReview(text), expected, text);
});

test('quotesRule returns the AGENTS.md rule a correction quotes, else null', () => {
  const rule = {
    source: 'AGENTS.md:7',
    text: 'Always create PRs in draft mode first',
    normalized: 'always create prs in draft mode first',
  };
  assert.equal(quotesRule('no — "always create  PRs in draft mode first"', [rule]), rule);
  assert.equal(quotesRule('no, use the other file', [rule]), null);
});

test('redact masks emails, tokens, keys, and URL passwords but leaves git SHAs alone', () => {
  const secrets = [
    'a.person@example.com',
    'AKIA' + 'A'.repeat(16),
    'ghp_' + 'x'.repeat(30),
    'sk-' + 'y'.repeat(30),
    'xoxb-' + '1'.repeat(12),
    ['eyJ' + 'a'.repeat(12), 'b'.repeat(12), 'c'.repeat(12)].join('.'),
    'Bearer ' + 'f'.repeat(24),
    'sdk-12345678-1234-1234-1234-123456789abc',
    'ATATT' + 'z'.repeat(30),
  ];
  const masked = redact(
    [
      ...secrets,
      'password=hunter22',
      'aws_secret_access_key=' + 'S'.repeat(40),
      'postgresql://app:p/ss#word@db.internal:5432/main',
    ].join('\n')
  );
  for (const secret of [...secrets, 'hunter22', 'S'.repeat(40), 'p/ss#word']) {
    assert.ok(!masked.includes(secret), secret);
  }
  const sha = 'c204316ede' + '0'.repeat(30);
  assert.equal(redact(`commit ${sha}`), `commit ${sha}`);
});

test('excerpt caps text at 300 characters with an ellipsis', () => {
  const capped = excerpt('x'.repeat(400));
  assert.equal(capped.length, 301);
  assert.ok(capped.endsWith('…'));
});

test('render cuts the latest events to fit the budget and says how many', () => {
  const events = Array.from({ length: 800 }, (_, i) => ({
    kind: 'failed_command',
    line: i + 1,
    text: 'x'.repeat(250),
  }));
  const meta = {
    path: 'p',
    branch: null,
    prs: new Set(),
    skills: new Set(),
    usage: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, turns: 0 },
    subagents: { count: 0, input: 0 },
  };
  const digest = render({ meta, events }, { mode: 'single', reasons: [] });
  assert.ok(digest.length <= 120_000, String(digest.length));
  assert.match(digest, /\[E1\] L1 failed_command/);
  assert.match(digest, /later events truncated/);
});

test('addRetryClusters flags failing repeats, not a parallel fan-out or different targets', () => {
  const failed = { failed: { line: 1, text: 'No workspaces found' } };
  const bash = (line) =>
    call('Bash', { command: 'npm test -w @scope/pkg' }, line, `m${line}`, failed);
  assert.equal(collect(addRetryClusters, [bash(1), bash(2), bash(3)])[0]?.kind, 'retry_cluster');
  const runs = [701, 702, 703].map((id, i) =>
    call('Bash', { command: `gh run view ${id} --log` }, i + 1)
  );
  assert.deepEqual(collect(addRetryClusters, runs), []);
  const agent = (line) => call('Agent', { prompt: 'review lane brief' }, line, 'm1');
  assert.deepEqual(collect(addRetryClusters, [agent(1), agent(2), agent(3), agent(4)]), []);
});

test('addEconomy reports repeat reads with the tools used', () => {
  const read = (line, args) => call('Read', args, line);
  const bash = (line, command) => call('Bash', { command }, line);
  const sameFile = collect(addEconomy, [
    read(1, { file_path: '/r/a.ts', offset: 0 }),
    read(2, { file_path: '/r/a.ts', offset: 50 }),
    bash(3, "sed -n '1,20p' /r/a.ts"),
  ]);
  assert.equal(sameFile.length, 1);
  assert.match(sameFile[0].text, /^3× read \/r\/a\.ts via Read, Bash/);
  assert.deepEqual(
    collect(addEconomy, [bash(1, 'cat $f'), bash(2, 'cat $f'), bash(3, 'cat $f')]),
    []
  );
  assert.deepEqual(
    collect(
      addEconomy,
      ['/r/a.ts', '/r/b.ts', '/r/c.ts'].map((file_path, i) => read(i + 1, { file_path }))
    ),
    []
  );
});

test('addEconomy flags a tool result over the heavy cutoff', () => {
  const [event] = collect(addEconomy, [
    call('Bash', { command: 'gh pr view 1' }, 4, 'm4', { resultChars: 30_000 }),
  ]);
  assert.equal(event.kind, 'heavy_result');
  assert.match(event.text, /30000 chars/);
});

test('integration: every eval scenario gets its expected mode', () => {
  const { evals } = JSON.parse(readFileSync(join(here, '..', 'evals', 'evals.json'), 'utf8'));
  for (const { name, files, expected_mode } of evals) {
    const run = spawnSync(
      'node',
      [join(here, 'digest.mjs'), join(here, '..', files[0]), '--out', '/dev/null'],
      {
        cwd: here,
        encoding: 'utf8',
      }
    );
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stderr.trim().split('\n').at(-1)).mode, expected_mode, name);
  }
});

test('integration: loadRuleLines returns nothing for a folder without AGENTS.md', () => {
  const empty = mkdtempSync(join(tmpdir(), 'retro-rules-'));
  try {
    assert.deepEqual(loadRuleLines(empty), []);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('integration: the CLI digests a transcript found under HOME for the current repo', () => {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: here,
    encoding: 'utf8',
  }).trim();
  const home = mkdtempSync(join(tmpdir(), 'retro-home-'));
  try {
    const dir = projectTranscriptDir(repoRoot, home);
    mkdirSync(join(dir, 's', 'subagents'), { recursive: true });
    const usage = { input_tokens: 7, output_tokens: 1 };
    const extra = [
      {
        type: 'assistant',
        message: { id: 'm9', usage, content: [{ type: 'text', text: 'running' }] },
      },
      {
        type: 'assistant',
        message: {
          id: 'm9',
          usage,
          content: [
            { type: 'tool_use', id: 't9', name: 'Bash', input: { command: 'gh pr diff 1' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 't9', content: 'y'.repeat(30_000) }],
        },
      },
    ];
    writeFileSync(
      join(dir, 's.jsonl'),
      readFileSync(join(here, 'fixtures', 'minimal.jsonl'), 'utf8') +
        extra.map((r) => JSON.stringify(r)).join('\n')
    );
    writeFileSync(
      join(dir, 's', 'subagents', 'agent-1.jsonl'),
      JSON.stringify({
        type: 'assistant',
        message: { id: 'x1', usage: { input_tokens: 100, cache_read_input_tokens: 900 } },
      })
    );
    const run = spawnSync('node', [join(here, 'digest.mjs')], {
      cwd: here,
      env: { ...process.env, HOME: home },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    const summary = JSON.parse(run.stderr.trim().split('\n').at(-1));
    assert.equal(summary.counts.failed_command, 1);
    assert.equal(summary.counts.heavy_result, 1);
    assert.match(run.stdout, /failed_command: 2× Read failed/);
    assert.match(run.stdout, /^- request: Add a sample feature$/m);
    assert.match(run.stdout, /- spend: main in 7 .* over 1 turns · 1 subagents in 1\.0K/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const BAND = {
  plugin: 'pr-status',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-11-26T00:00:00Z')

function stubEngine(on: Parameters<TestBody>[1]) {
  on('process.run', (_, e) => ({ value: answerGh(e.argv) }))
  on('clock.now', () => ({ value: NOW }))
  on('clock.every', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))
}

const REVIEWED_PULL_REQUEST = JSON.stringify({
  number: 1648,
  url: 'https://github.com/acme/app/pull/1648',
  state: 'OPEN',
  isDraft: false,
  reviewDecision: 'REVIEW_REQUIRED',
  statusCheckRollup: [],
  reviews: [],
})

function ran(exitCode: number, stdout: string, stderr: string) {
  return { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false }
}

function answerGh(argv: readonly string[]) {
  if (argv[0] !== 'gh') return ran(1, '', '')
  const selector = argv[3]
  if (selector === '--json') return ran(1, '', 'no pull requests found for branch "claude/pr-review-x"')
  if (selector === '1648' || selector === 'https://github.com/acme/app/pull/1648') return ran(0, REVIEWED_PULL_REQUEST, '')
  return ran(1, '', 'not found')
}

for (const [label, command] of [
  ['a numbered gh pr command', 'gh pr view 1648 --json number,title'],
  ['a gh api pulls call', 'gh api repos/acme/app/pulls/1648/reviews --input -'],
] as const) {
  test(`the band shows the PR named in ${label} when the branch has none`, async ($, on) => {
    stubEngine(on)

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /review needed/ })).toBeDefined()
      await ui.unmount()
    }
  })
}

test('the band draws no PR row when neither the branch nor the session has one', async ($, on) => {
  stubEngine(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr list' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /review needed/ })).toBeUndefined()
  await ui.unmount()
})

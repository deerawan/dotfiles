import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, McpToolResult, Register } from 'claude-code'

import type { ChecksState, PullRequest, ReviewState } from '../types'

const PULL_REQUEST_CHECK_INTERVAL_MS = 60 * 1000
const PULL_REQUEST_FIELDS = 'number,url,state,isDraft,reviewDecision,statusCheckRollup,reviews'
const PULL_REQUEST_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/
const GH_COMMAND = /\bgh\s/
const GH_API_PULL = /\bgh\s+api\s+\S*repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)/
const GH_PR_NUMBER = /\bgh\s+pr\s+(?:view|checkout|diff|review|comment|edit|ready|merge|checks|close|reopen)\s+#?(\d+)\b/
const GH_REPO_FLAG = /(?:-R|--repo)[\s=]+([\w.-]+\/[\w.-]+)/
const BUILT_IN_BROWSER_SERVER = 'Claude Browser'
const DESKTOP_VIEW_SERVER = 'ccd_view'
const FAILED_CHECK_RESULTS = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'])
const PENDING_CHECK_STATES = new Set(['PENDING', 'EXPECTED'])
const REVIEW_STATES: Record<string, ReviewState> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  REVIEW_REQUIRED: 'review-required',
}
const GAP = '   '
const CHECKS_BADGES: Record<ChecksState, { dot: Color; text: string; isQuiet: boolean } | null> = {
  passing: { dot: 'success', text: 'checks passing', isQuiet: true },
  failing: { dot: 'error', text: 'checks failing', isQuiet: false },
  pending: { dot: 'warning', text: 'checks running', isQuiet: true },
  none: null,
}
const REVIEW_BADGES: Record<ReviewState, { dot: string; color: Color; note: string } | null> = {
  approved: { dot: '●', color: 'success', note: 'approved' },
  'changes-requested': { dot: '●', color: 'error', note: 'changes requested' },
  'review-required': { dot: '○', color: 'subtle', note: 'review needed' },
  none: null,
}

type PullRequestStatus = 'open' | 'draft' | 'merged' | 'closed'

const PR_ICON_STEM = '<circle cx="4" cy="3.5" r="1.75"/><circle cx="4" cy="12.5" r="1.75"/><path d="M4 5.25v5.5"/>'
const PR_ICONS: Record<PullRequestStatus, { color: string; paths: string }> = {
  open: {
    color: '#3fb950',
    paths: `${PR_ICON_STEM}<circle cx="12" cy="12.5" r="1.75"/><path d="M12 10.75V6.5a2 2 0 0 0-2-2H7.5"/><path d="M9 3 7.5 4.5 9 6"/>`,
  },
  draft: {
    color: '#8b949e',
    paths: `${PR_ICON_STEM}<circle cx="12" cy="12.5" r="1.75"/><path d="M12 9.5v-1M12 6.5v-1M12 3.5v-1"/>`,
  },
  merged: {
    color: '#a371f7',
    paths: `${PR_ICON_STEM}<circle cx="12" cy="9" r="1.75"/><path d="M4 5.25c0 2.5 2 3.75 6.25 3.75"/>`,
  },
  closed: {
    color: '#f85149',
    paths: `${PR_ICON_STEM}<circle cx="12" cy="12.5" r="1.75"/><path d="m10 2.5 4 4M14 2.5l-4 4"/>`,
  },
}

function pullRequestStatus(pr: PullRequest): PullRequestStatus {
  if (pr.state === 'MERGED') return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  return pr.isDraft ? 'draft' : 'open'
}

function statusIconSvg(status: PullRequestStatus) {
  const { color, paths } = PR_ICONS[status]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

type GhCheck = {
  name?: string | null
  context?: string | null
  status?: string | null
  conclusion?: string | null
  state?: string | null
  startedAt?: string | null
}

type GhReview = {
  author?: { login?: string | null } | null
  state?: string | null
  submittedAt?: string | null
}

type GhPullRequest = {
  number: number
  url: string
  state: string
  isDraft: boolean
  reviewDecision?: string | null
  statusCheckRollup?: GhCheck[] | null
  reviews?: GhReview[] | null
}

type BashOutput = { gitOperation?: { pr?: { number: number; url?: string } } }

type BrowserTab = {
  tabId: string
  origin: string
}

const pullRequest = atom({ plugin: 'pr-status', key: 'pullRequest' } as const, null, { shape: 'pr-status-1' })
const sessionPullRequest = atom({ plugin: 'pr-status', key: 'sessionPullRequest' } as const, null)

let lastPullRequestCheckAt = -Infinity

function latestRunPerCheck(checks: GhCheck[]) {
  const latest = new Map<string, GhCheck>()
  for (const check of checks) {
    const name = check.name ?? check.context ?? ''
    const seen = latest.get(name)
    if (!seen || (check.startedAt ?? '') > (seen.startedAt ?? '')) latest.set(name, check)
  }
  return [...latest.values()]
}

function isFailedCheck(check: GhCheck) {
  return FAILED_CHECK_RESULTS.has(check.conclusion ?? '') || FAILED_CHECK_RESULTS.has(check.state ?? '')
}

function isPendingCheck(check: GhCheck) {
  return (check.status != null && check.status !== 'COMPLETED') || PENDING_CHECK_STATES.has(check.state ?? '')
}

function summarizeChecks(checks: GhCheck[]): ChecksState {
  const current = latestRunPerCheck(checks)
  if (current.length === 0) return 'none'
  if (current.some(isFailedCheck)) return 'failing'
  if (current.some(isPendingCheck)) return 'pending'
  return 'passing'
}

function countApprovals(reviews: GhReview[]) {
  const latestByAuthor = new Map<string, GhReview>()
  for (const review of reviews) {
    const author = review.author?.login
    if (!author || review.state === 'COMMENTED' || review.state === 'PENDING') continue
    const seen = latestByAuthor.get(author)
    if (!seen || (review.submittedAt ?? '') > (seen.submittedAt ?? '')) latestByAuthor.set(author, review)
  }
  return [...latestByAuthor.values()].filter(review => review.state === 'APPROVED').length
}

function toPullRequest(raw: GhPullRequest): PullRequest {
  return {
    number: raw.number,
    url: raw.url,
    state: raw.state,
    isDraft: raw.isDraft,
    checks: summarizeChecks(raw.statusCheckRollup ?? []),
    review: REVIEW_STATES[raw.reviewDecision ?? ''] ?? 'none',
    approvals: countApprovals(raw.reviews ?? []),
  }
}

function approvalsText(count: number) {
  return `${count} approval${count === 1 ? '' : 's'}`
}

function pullRequestNamedIn(command: string): string | null {
  if (!GH_COMMAND.test(command)) return null
  const url = PULL_REQUEST_URL.exec(command)
  if (url) return url[0]
  const apiPull = GH_API_PULL.exec(command)
  if (apiPull) return `https://github.com/${apiPull[1]}/pull/${apiPull[2]}`
  const numbered = GH_PR_NUMBER.exec(command)
  if (!numbered) return null
  const repo = GH_REPO_FLAG.exec(command)
  return repo ? `https://github.com/${repo[1]}/pull/${numbered[1]}` : numbered[1] ?? null
}

async function viewPullRequest($: EngineInterface, selector: string[]) {
  const { exitCode, stdout } = await $.process.run(['gh', 'pr', 'view', ...selector, '--json', PULL_REQUEST_FIELDS])
  return exitCode === 0 ? toPullRequest(JSON.parse(stdout)) : null
}

async function refreshPullRequest($: EngineInterface, isForced = false) {
  const now = await $.clock.now()
  if (!isForced && now - lastPullRequestCheckAt < PULL_REQUEST_CHECK_INTERVAL_MS) return
  lastPullRequestCheckAt = now
  const onBranch = await viewPullRequest($, [])
  const named = onBranch ? null : await read($, sessionPullRequest)
  const found = onBranch ?? (named ? await viewPullRequest($, [named]) : null)
  await update($, pullRequest, () => found)
}

async function rememberPullRequest($: EngineInterface, named: string) {
  if ((await read($, sessionPullRequest)) === named) return
  await update($, sessionPullRequest, () => named)
  await refreshPullRequest($, true)
}

function firstText(result: McpToolResult) {
  return result.content.find(content => content.type === 'text')?.text ?? ''
}

function parseOpenTabs(result: McpToolResult): BrowserTab[] {
  const text = firstText(result)
  const json = text.slice(text.indexOf('{'), text.indexOf('\n}') + 2)
  return (JSON.parse(json) as { tabs?: BrowserTab[] }).tabs ?? []
}

function isSamePage(href: string, url: string) {
  return href === url || [`${url}/`, `${url}#`, `${url}?`].some(prefix => href.startsWith(prefix))
}

async function tabHref($: EngineInterface, tabId: string) {
  const result = await $.mcp.call(BUILT_IN_BROWSER_SERVER, 'javascript_tool', {
    action: 'javascript_exec',
    text: 'location.href',
    tabId,
  })
  const [firstLine] = firstText(result).split('\n')
  return result.isError || !firstLine ? null : (JSON.parse(firstLine) as string)
}

async function findOpenTab($: EngineInterface, url: string) {
  const tabs = parseOpenTabs(await $.mcp.call(BUILT_IN_BROWSER_SERVER, 'tabs_context'))
  const origin = new URL(url).origin
  for (const tab of tabs.filter(candidate => candidate.origin === origin)) {
    const href = await tabHref($, tab.tabId).catch(() => null)
    if (href && isSamePage(href, url)) return tab.tabId
  }
  return null
}

async function openInBuiltInBrowser($: EngineInterface, url: string) {
  const openTabId = await findOpenTab($, url).catch(() => null)
  const result = await (openTabId
    ? $.mcp.call(BUILT_IN_BROWSER_SERVER, 'tabs_select', { tabId: openTabId })
    : $.mcp.call(BUILT_IN_BROWSER_SERVER, 'preview_start', { url })
  ).catch(() => null)
  if (!result || result.isError) {
    await $.process.run(['open', url])
    return
  }
  await $.mcp.call(DESKTOP_VIEW_SERVER, 'show_pane', { pane: 'preview' }).catch(() => null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refreshPullRequest($).catch(() => undefined)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) void refreshPullRequest($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool !== 'Bash') return ran
    const output = ran.deny === undefined && !ran.isError ? (ran.result as BashOutput) : undefined
    const operated = output?.gitOperation?.pr
    const named = operated ? operated.url ?? `${operated.number}` : pullRequestNamedIn(e.command)
    if (named && !e.agentId) void rememberPullRequest($, named).catch(() => undefined)
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const pr = await read($, pullRequest)
    if (!pr) return next(e)

    const { Box, Button, Text, Link } = $.ui.resolve(e)

    const label = `#${pr.number}`
    const status = pullRequestStatus(pr)
    const isOpen = pr.state === 'OPEN'
    const Svg = e.surface === 'desktop' ? $.ui.resolve(e).Svg : null
    const icon = Svg ? <Svg source={statusIconSvg(status)} alt={status} width={16} height={16} /> : null
    const checks = isOpen ? CHECKS_BADGES[pr.checks] : null
    const review = isOpen ? REVIEW_BADGES[pr.review] : null

    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center" paddingX={1}>
        {e.surface === 'desktop' ? (
          <Box flexDirection="row" alignItems="center">
            {icon}
            <Button label={label} plain onPress={() => openInBuiltInBrowser($, pr.url)} />
          </Box>
        ) : (
          <Box flexDirection="row">
            <Link href={pr.url} label={label} />
            <Text dimColor>{` ${status}`}</Text>
          </Box>
        )}
        {checks ? (
          <Text>
            <Text>{GAP}</Text>
            <Text color={checks.dot}>●</Text>
            <Text dimColor={checks.isQuiet}>{` ${checks.text}`}</Text>
          </Text>
        ) : null}
        {review ? (
          <Text>
            <Text>{GAP}</Text>
            <Text color={review.color}>{review.dot}</Text>
            <Text>{` ${approvalsText(pr.approvals)}`}</Text>
            <Text dimColor>{` · ${review.note}`}</Text>
          </Text>
        ) : isOpen && pr.approvals > 0 ? (
          <Text>
            <Text>{GAP}</Text>
            <Text color="success">●</Text>
            <Text>{` ${approvalsText(pr.approvals)}`}</Text>
          </Text>
        ) : null}
      </Box>
    )
  })
}

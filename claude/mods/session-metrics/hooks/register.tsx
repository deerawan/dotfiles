import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register, SessionContextUsage, TurnUsage } from 'claude-code'

import type {
  CacheReading,
  CacheState,
  ChecksState,
  ContextWindow,
  PullRequest,
  RateLimitWindow,
  ReviewState,
} from '../types'

const PULL_REQUEST_CHECK_INTERVAL_MS = 60 * 1000
const PULL_REQUEST_FIELDS = 'number,url,state,isDraft,reviewDecision,statusCheckRollup'
const NO_PULL_REQUEST_MESSAGE = 'no pull requests found'
const CREATE_PULL_REQUEST_PROMPT =
  'Open a draft pull request for the current branch. If this project has a skill for creating pull requests, invoke it and follow its steps instead of running gh pr create yourself; open the PR as a draft either way.'
const FAILED_CHECK_RESULTS = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'])
const PENDING_CHECK_STATES = new Set(['PENDING', 'EXPECTED'])
const REVIEW_STATES: Record<string, ReviewState> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  REVIEW_REQUIRED: 'review-required',
}
const WARNING_PERCENT = 50
const DANGER_PERCENT = 80
const MINUTE_MS = 60 * 1000
const FIVE_MINUTES_MS = 5 * MINUTE_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WARM_HIT_PERCENT = 80
const COLD_HIT_PERCENT = 20
const CACHE_BADGES: Record<CacheState | 'expired', { icon: string; color: Color }> = {
  warm: { icon: '🔥', color: 'success' },
  partial: { icon: '🌤️', color: 'warning' },
  cold: { icon: '🧊', color: 'error' },
  expired: { icon: '💤', color: 'subtle' },
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LIMIT_LABELS: Record<string, string> = { five_hour: '⏱️ 5h', seven_day: '📅 wk' }
const PULL_REQUEST_COLORS: Record<string, Color> = { OPEN: 'success', MERGED: 'merged', CLOSED: 'error' }
const CHECKS_BADGES: Record<ChecksState, { text: string; color: Color } | null> = {
  passing: { text: '✅ CI', color: 'success' },
  failing: { text: '❌ CI', color: 'error' },
  pending: { text: '⏳ CI', color: 'warning' },
  none: null,
}
const REVIEW_BADGES: Record<ReviewState, { text: string; color: Color } | null> = {
  approved: { text: '👍 approved', color: 'success' },
  'changes-requested': { text: '✋ changes requested', color: 'error' },
  'review-required': { text: '👀 needs review', color: 'subtle' },
  none: null,
}

type GhCheck = {
  name?: string | null
  context?: string | null
  status?: string | null
  conclusion?: string | null
  state?: string | null
  startedAt?: string | null
}

type GhPullRequest = {
  number: number
  url: string
  state: string
  isDraft: boolean
  reviewDecision?: string | null
  statusCheckRollup?: GhCheck[] | null
}

const rateLimits = atom({ plugin: 'session-metrics', key: 'rateLimits' } as const, [])
const contextWindow = atom({ plugin: 'session-metrics', key: 'contextWindow' } as const, null)
const costUsd = atom({ plugin: 'session-metrics', key: 'costUsd' } as const, null)
const pullRequest = atom({ plugin: 'session-metrics', key: 'pullRequest' } as const, null, { shape: 'pr-status-2' })
const canCreatePullRequest = atom({ plugin: 'session-metrics', key: 'canCreatePullRequest' } as const, false)
const isCreatingPullRequest = atom({ plugin: 'session-metrics', key: 'isCreatingPullRequest' } as const, false)
const cacheReading = atom({ plugin: 'session-metrics', key: 'cacheReading' } as const, null)
const clockTick = atom({ plugin: 'session-metrics', key: 'clockTick' } as const, 0)

let lastPullRequestCheckAt = -Infinity
let localOffsetMs = 0
let pullRequestTurnId: string | null = null

function severityColor(percent: number): Color {
  if (percent >= DANGER_PERCENT) return 'error'
  if (percent >= WARNING_PERCENT) return 'warning'
  return 'success'
}

function clockTime(local: Date) {
  const hours = local.getUTCHours()
  const minutes = `${local.getUTCMinutes()}`.padStart(2, '0')
  return `${hours % 12 || 12}:${minutes}${hours < 12 ? 'am' : 'pm'}`
}

function resetLabel(resetsAt: string, now: number) {
  const resetMs = Date.parse(resetsAt)
  const local = new Date(resetMs + localOffsetMs)
  const isWithinDay = resetMs - now < DAY_MS
  return isWithinDay
    ? clockTime(local)
    : `${WEEKDAYS[local.getUTCDay()]} ${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`
}

function countdown(remainingMs: number) {
  const remaining = Math.max(0, remainingMs)
  const days = Math.floor(remaining / DAY_MS)
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS)
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function cacheState(hitPercent: number): CacheState {
  if (hitPercent >= WARM_HIT_PERCENT) return 'warm'
  if (hitPercent <= COLD_HIT_PERCENT) return 'cold'
  return 'partial'
}

function cacheTtlMs(usage: TurnUsage, previous: number | null) {
  if ((usage.ephemeral_1h_input_tokens ?? 0) > 0) return HOUR_MS
  if ((usage.ephemeral_5m_input_tokens ?? 0) > 0) return FIVE_MINUTES_MS
  return previous
}

function toCacheReading(usage: TurnUsage, requestedAt: number, previous: CacheReading | null): CacheReading | null {
  const promptTokens = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
  if (promptTokens === 0) return previous
  return {
    hitPercent: (usage.cache_read_input_tokens / promptTokens) * 100,
    writtenTokens: usage.cache_creation_input_tokens,
    promptTokens,
    requestedAt,
    ttlMs: cacheTtlMs(usage, previous?.ttlMs ?? null),
  }
}

function cacheStatus(reading: CacheReading, now: number) {
  const expiresAt = reading.ttlMs === null ? null : reading.requestedAt + reading.ttlMs
  const isExpired = expiresAt !== null && now >= expiresAt
  const state: CacheState | 'expired' = isExpired ? 'expired' : cacheState(reading.hitPercent)
  const expiresIn = expiresAt !== null && !isExpired ? countdown(expiresAt - now) : null
  return { state, expiresIn, ...CACHE_BADGES[state] }
}

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

function toPullRequest(raw: GhPullRequest): PullRequest {
  return {
    number: raw.number,
    url: raw.url,
    state: raw.state,
    isDraft: raw.isDraft,
    checks: summarizeChecks(raw.statusCheckRollup ?? []),
    review: REVIEW_STATES[raw.reviewDecision ?? ''] ?? 'none',
  }
}

async function readLocalOffset($: EngineInterface) {
  const { exitCode, stdout } = await $.process.run(['date', '+%z'])
  const match = exitCode === 0 ? /^([+-])(\d{2})(\d{2})$/.exec(stdout.trim()) : null
  if (!match) return
  const [, sign, hours, minutes] = match
  localOffsetMs = (sign === '-' ? -1 : 1) * (Number(hours) * HOUR_MS + Number(minutes) * MINUTE_MS)
}

async function refreshPullRequest($: EngineInterface, isForced: boolean) {
  const now = await $.clock.now()
  if (!isForced && now - lastPullRequestCheckAt < PULL_REQUEST_CHECK_INTERVAL_MS) return
  lastPullRequestCheckAt = now
  const { exitCode, stdout, stderr } = await $.process.run(['gh', 'pr', 'view', '--json', PULL_REQUEST_FIELDS])
  const found = exitCode === 0 ? toPullRequest(JSON.parse(stdout)) : null
  await update($, pullRequest, () => found)
  await update($, canCreatePullRequest, () => stderr.includes(NO_PULL_REQUEST_MESSAGE))
}

async function askClaudeToCreatePullRequest($: EngineInterface) {
  await update($, isCreatingPullRequest, () => true)
  await $.prompt.submit({ text: CREATE_PULL_REQUEST_PROMPT })
}

async function finishCreatingPullRequest($: EngineInterface) {
  pullRequestTurnId = null
  await refreshPullRequest($, true)
  await update($, isCreatingPullRequest, () => false)
}

async function seedMeasurements($: EngineInterface) {
  const usage = await $.session.usage()
  await update($, costUsd, () => usage.cost?.usd ?? null)
  await update($, contextWindow, () => toContextWindow(usage.context))
  if (usage.rateLimits.length > 0) await update($, rateLimits, () => usage.rateLimits)
}

function toContextWindow(context: SessionContextUsage): ContextWindow | null {
  if (context.tokens === undefined || context.percent === undefined) return null
  return { tokens: context.tokens, window: context.window, percent: context.percent }
}

function refreshInBackground($: EngineInterface) {
  void readLocalOffset($).catch(() => undefined)
  void seedMeasurements($).catch(() => undefined)
  void refreshPullRequest($, false).catch(() => undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await update($, isCreatingPullRequest, () => false)
    refreshInBackground($)
    $.clock.every(MINUTE_MS, () => void update($, clockTick, tick => tick + 1))
    return started
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId && e.text === CREATE_PULL_REQUEST_PROMPT) pullRequestTurnId = e.turnId
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const requestedAt = await $.clock.now()
    const result = yield* next(e)
    const { usage } = result
    if (!e.agentId && usage) await update($, cacheReading, previous => toCacheReading(usage, requestedAt, previous))
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, costUsd, () => e.cost?.usd ?? null)
    await update($, rateLimits, () => e.rateLimits)
    await update($, contextWindow, () => toContextWindow(e.context))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.turnId === pullRequestTurnId) void finishCreatingPullRequest($).catch(() => undefined)
    else if (!e.agentId) refreshInBackground($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const [cache, , context, limits, cost, pr, canCreate, isCreating, now] = await Promise.all([
      read($, cacheReading),
      read($, clockTick),
      read($, contextWindow),
      read($, rateLimits),
      read($, costUsd),
      read($, pullRequest),
      read($, canCreatePullRequest),
      read($, isCreatingPullRequest),
      $.clock.now(),
    ])
    const { Box, Button, Text, Link } = $.ui.resolve(e)
    const shownLimits = limits.filter(limit => limit.kind in LIMIT_LABELS)

    const percentPiece = (key: string, label: string, percent: number, suffix: string | null) => (
      <Text key={key} tabular>
        <Text dimColor>{`${label} `}</Text>
        <Text bold color={severityColor(percent)}>{`${Math.round(percent)}%`}</Text>
        {suffix ? <Text dimColor>{` ${suffix}`}</Text> : null}
      </Text>
    )

    const cachePiece = (reading: CacheReading) => {
      const status = cacheStatus(reading, now)
      return (
        <Text key="cache">
          <Text>{`${status.icon} `}</Text>
          <Text bold color={status.color}>{status.state}</Text>
          {status.expiresIn ? <Text dimColor>{` ${status.expiresIn}`}</Text> : null}
        </Text>
      )
    }

    const badge = (key: string, found: { text: string; color: Color } | null) =>
      found ? <Text key={key} color={found.color}>{`  ${found.text}`}</Text> : null

    const pullRequestPiece = () => {
      if (pr) {
        const stateColor = pr.isDraft ? 'subtle' : PULL_REQUEST_COLORS[pr.state] ?? 'text'
        const stateText = pr.isDraft && pr.state === 'OPEN' ? 'draft' : pr.state.toLowerCase()
        return (
          <Box key="pr" flexDirection="row">
            <Text>🔀 </Text>
            <Link href={pr.url} label={`PR #${pr.number}`} />
            <Text color={stateColor}>{` ${stateText}`}</Text>
            {badge('checks', CHECKS_BADGES[pr.checks])}
            {badge('review', REVIEW_BADGES[pr.review])}
          </Box>
        )
      }
      if (isCreating) return <Text key="pr" color="warning">⏳ Creating draft PR…</Text>
      if (canCreate) {
        return (
          <Button key="create-pr" label="Create draft PR" variant="primary" onPress={() => askClaudeToCreatePullRequest($)} />
        )
      }
      return <Text key="pr" color="subtle">🔀 no PR</Text>
    }

    const pieces = [
      context ? percentPiece('context', '🧠 ctx', context.percent, null) : null,
      cache ? cachePiece(cache) : null,
      ...shownLimits.map(limit =>
        percentPiece(limit.kind, LIMIT_LABELS[limit.kind] ?? limit.kind, limit.percentUsed, limit.resetsAt ? `↻ ${resetLabel(limit.resetsAt, now)}` : null),
      ),
      <Text key="cost">
        <Text>💰 </Text>
        <Text bold color="claude">{`$${(cost ?? 0).toFixed(2)}`}</Text>
      </Text>,
      pullRequestPiece(),
    ].filter(piece => piece !== null)

    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="center">
        {pieces.flatMap((piece, index) =>
          index === 0 ? [piece] : [<Text key={`separator-${index}`} color="subtle">{'  ·  '}</Text>, piece],
        )}
      </Box>
    )
  })
}

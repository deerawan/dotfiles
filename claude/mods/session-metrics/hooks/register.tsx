import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register, SessionContextUsage, TurnUsage } from 'claude-code'

import type { CacheReading, CacheState, ContextWindow, RateLimitWindow } from '../types'

const WARNING_PERCENT = 50
const DANGER_PERCENT = 80
const MINUTE_MS = 60 * 1000
const FIVE_MINUTES_MS = 5 * MINUTE_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WARM_HIT_PERCENT = 80
const COLD_HIT_PERCENT = 20
const DESKTOP_DIVIDER = 'rgba(128, 128, 128, 0.45)'
const DIVIDER = '  │  '
const CACHE_COLORS: Record<CacheState | 'expired', Color | null> = {
  warm: null,
  partial: null,
  cold: 'warning',
  expired: 'subtle',
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'week' }

const rateLimits = atom({ plugin: 'session-metrics', key: 'rateLimits' } as const, [])
const contextWindow = atom({ plugin: 'session-metrics', key: 'contextWindow' } as const, null)
const costUsd = atom({ plugin: 'session-metrics', key: 'costUsd' } as const, null)
const cacheReading = atom({ plugin: 'session-metrics', key: 'cacheReading' } as const, null)
const clockTick = atom({ plugin: 'session-metrics', key: 'clockTick' } as const, 0)

let localOffsetMs = 0

function severityColor(percent: number): Color | null {
  if (percent >= DANGER_PERCENT) return 'error'
  if (percent >= WARNING_PERCENT) return 'warning'
  return null
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
  return isWithinDay ? clockTime(local) : `${WEEKDAYS[local.getUTCDay()]} ${clockTime(local)}`
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
  return { state, expiresIn, color: CACHE_COLORS[state] }
}

async function readLocalOffset($: EngineInterface) {
  const { exitCode, stdout } = await $.process.run(['date', '+%z'])
  const match = exitCode === 0 ? /^([+-])(\d{2})(\d{2})$/.exec(stdout.trim()) : null
  if (!match) return
  const [, sign, hours, minutes] = match
  localOffsetMs = (sign === '-' ? -1 : 1) * (Number(hours) * HOUR_MS + Number(minutes) * MINUTE_MS)
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
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    refreshInBackground($)
    $.clock.every(MINUTE_MS, () => void update($, clockTick, tick => tick + 1))
    return started
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
    if (!e.agentId) refreshInBackground($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const [cache, , context, limits, cost, now] = await Promise.all([
      read($, cacheReading),
      read($, clockTick),
      read($, contextWindow),
      read($, rateLimits),
      read($, costUsd),
      $.clock.now(),
    ])
    const { Box, Text } = $.ui.resolve(e)
    const shownLimits = limits.filter(limit => limit.kind in LIMIT_LABELS)

    const percentPiece = (key: string, label: string, percent: number, suffix: string | null) => {
      const color = severityColor(percent)
      return (
        <Text key={key} tabular>
          <Text dimColor>{`${label} `}</Text>
          {color ? <Text color={color}>{`${Math.round(percent)}%`}</Text> : <Text>{`${Math.round(percent)}%`}</Text>}
          {suffix ? <Text dimColor>{` · ${suffix}`}</Text> : null}
        </Text>
      )
    }

    const cachePiece = (reading: CacheReading) => {
      const status = cacheStatus(reading, now)
      return (
        <Text key="cache">
          <Text dimColor>cache </Text>
          {status.color ? <Text color={status.color}>{status.state}</Text> : <Text>{status.state}</Text>}
          {status.expiresIn ? <Text dimColor>{` ${status.expiresIn}`}</Text> : null}
        </Text>
      )
    }

    const pieces = [
      context ? percentPiece('context', 'ctx', context.percent, null) : null,
      cache ? cachePiece(cache) : null,
      ...shownLimits.map(limit =>
        percentPiece(limit.kind, LIMIT_LABELS[limit.kind] ?? limit.kind, limit.percentUsed, limit.resetsAt ? resetLabel(limit.resetsAt, now) : null),
      ),
      <Text key="cost" tabular>
        <Text dimColor>cost </Text>
        <Text>{`$${(cost ?? 0).toFixed(2)}`}</Text>
      </Text>,
    ].filter(piece => piece !== null)

    const isDesktop = e.surface === 'desktop'
    const divider = (index: number) => (
      <Text key={`divider-${index}`} color={isDesktop ? DESKTOP_DIVIDER : 'subtle'}>
        {DIVIDER}
      </Text>
    )

    return (
      <Box
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        paddingX={1}
        marginBottom="xs"
      >
        {pieces.flatMap((piece, index) => (index === 0 ? [piece] : [divider(index), piece]))}
      </Box>
    )
  })
}

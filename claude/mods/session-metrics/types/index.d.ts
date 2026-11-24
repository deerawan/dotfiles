export type ChecksState = 'passing' | 'failing' | 'pending' | 'none'
export type ReviewState = 'approved' | 'changes-requested' | 'review-required' | 'none'
export type PullRequest = {
  number: number
  url: string
  state: string
  isDraft: boolean
  checks: ChecksState
  review: ReviewState
}
export type ContextWindow = { tokens: number; window: number; percent: number }
export type CacheState = 'warm' | 'partial' | 'cold'
export type CacheReading = { hitPercent: number; writtenTokens: number; promptTokens: number; requestedAt: number; ttlMs: number | null }
export type RateLimitWindow = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'session-metrics': {
      rateLimits: RateLimitWindow[]
      contextWindow: ContextWindow | null
      cacheReading: CacheReading | null
      clockTick: number
      costUsd: number | null
      pullRequest: Shaped<PullRequest | null>
      canCreatePullRequest: boolean
      isCreatingPullRequest: boolean
    }
  }
}

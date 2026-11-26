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
    }
  }
}

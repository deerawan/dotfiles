export type ChecksState = 'passing' | 'failing' | 'pending' | 'none'
export type ReviewState = 'approved' | 'changes-requested' | 'review-required' | 'none'
export type PullRequest = {
  number: number
  url: string
  state: string
  isDraft: boolean
  checks: ChecksState
  review: ReviewState
  approvals: number
}

declare module 'claude-code' {
  interface PluginState {
    'pr-status': {
      pullRequest: Shaped<PullRequest | null>
      sessionPullRequest: string | null
    }
  }
}

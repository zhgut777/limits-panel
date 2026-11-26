export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snap = {
  limits: Limit[]
  contextPercent?: number
  contextTokens?: number
  contextWindow: number
  usd?: number
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'limits-panel': { snap: Shaped<Snap | null>; history: Shaped<number[]> }
  }
}

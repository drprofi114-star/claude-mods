export type Call = { id: string; tool: string; isDone: boolean }

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': { calls: Call[]; tick: number }
  }
}

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Call } from '../types'

const PANE = 'agent-dashboard'
const calls = atom({ plugin: 'agent-dashboard', key: 'calls' } as const, [] as Call[])
const tick = atom({ plugin: 'agent-dashboard', key: 'tick' } as const, 0)

const LABEL: Record<string, string> = {
  pending: 'кутяпти', running: 'ишлаяпти', waiting: 'навбатда', idle: 'бекор',
  completed: 'тайёр', failed: 'хато', killed: 'тўхтатилган',
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'dashboard', description: 'Агентлар ва лойиҳа ҳолати панели' })
    void $.ui.open({ id: PANE, title: 'Дашборд' })
    $.clock.every(2000, () => update($, tick, (n) => n + 1))
    return next(e)
  })

  on('command.run', { command: 'dashboard' }, async ($) => {
    await $.ui.open({ id: PANE, title: 'Дашборд' })
    return { text: 'Дашборд очилди.' }
  })

  on('tool.call', async ($, e, next) => {
    const c: Call = { id: e.tool_use_id, tool: e.tool, isDone: false }
    await update($, calls, (l) => [...l, c].slice(-100))
    const ran = await next(e)
    await update($, calls, (l) => l.map((x) => (x.id === c.id ? { ...x, isDone: true } : x)))
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, tick) // 2 сонияда бир янгиланади
    const list = await read($, calls)
    const agents = await $.agent.list()
    const cwd = await $.session.cwd()
    const repo = await $.session.repo()
    const usage = await $.session.usage()
    const room = Math.max(3, (e.viewport?.rows ?? 24) - 14)
    const running = list.filter((c) => !c.isDone).length

    return (
      <Box flexDirection="column">
        <Text bold>Лойиҳа</Text>
        <Text>{cwd}</Text>
        <Text dimColor>{repo ? 'git репозиторий' : 'git йўқ'} · контекст: {Math.round(usage.context.percent ?? 0)}%</Text>
        <Text> </Text>
        <Text bold>Агентлар ({agents.length})</Text>
        {agents.length === 0 && <Text dimColor>Фаол агент йўқ.</Text>}
        {agents.slice(-8).map((a) => (
          <Text>
            {a.status === 'running' ? '●' : a.status === 'completed' ? '✓' : '○'} {a.type} — {a.description.slice(0, 40)} [{LABEL[a.status] ?? a.status}]
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Асбоблар ({list.length}, ишлаётгани: {running})</Text>
        {list.slice(-room).map((c) => (
          <Text dimColor={c.isDone}>{c.isDone ? '✓' : '…'} {c.tool}</Text>
        ))}
      </Box>
    )
  })
}

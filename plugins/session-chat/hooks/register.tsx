import type { Register } from 'claude-code'

type Peer = { id: string; name: string; cwd: string; seen: number }
type Msg = { id: string; to: string; from: string; text: string; at: number }

const PEERS = 'peers'
const INBOX = 'inbox'
const ALIVE_MS = 30_000

export const register: Register = (on) => {
  let myId = ''
  let myName = ''

  let deliverNow: (() => Promise<void>) | null = null

  on('session.start', async ($, e, next) => {
    myId = await $.session.id()
    const cwd = await $.session.cwd()
    myName = cwd.split('/').filter(Boolean).pop() ?? myId.slice(0, 6)
    const beat = async () => {
      const all = ((await $.store.get(PEERS)) as Record<string, Peer> | undefined) ?? {}
      const now = await $.clock.now()
      all[myId] = { id: myId, name: myName, cwd: await $.session.cwd(), seen: now }
      for (const k of Object.keys(all)) if (now - all[k].seen > 10 * 60_000) delete all[k]
      await $.store.set(PEERS, all)
    }
    const deliver = async () => {
      const box = ((await $.store.get(INBOX)) as Msg[] | undefined) ?? []
      const mine = box.filter((m) => m.to === myId)
      if (mine.length === 0) return
      await $.store.set(INBOX, box.filter((m) => m.to !== myId))
      for (const m of mine) {
        const text = `[Бошқа Claude сессиясидан хабар: ${m.from}]\n${m.text}`
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
        $.ui.toast(`Хабар: ${m.from}`)
      }
      void $.prompt.submit({ text: 'Бошқа сессиядан келган хабарни ўқиб, зарур бўлса бажар.' })
    }
    deliverNow = deliver
    await beat()
    await $.command.register({ name: 'sessions', description: 'Фаол Claude сессиялари рўйхати' })
    await $.command.register({
      name: 'tell',
      description: 'Бошқа сессияга хабар юбориш: /tell <ном|id> <матн>',
      argumentHint: '<ном|id> <матн>',
    })
    await $.command.register({ name: 'inbox', description: 'Келган хабарларни дарҳол қабул қилиш' })
    $.clock.every(5000, async () => {
      await beat()
      await deliver()
    })
    return next(e)
  })

  on('command.run', { command: 'sessions' }, async ($) => {
    const all = Object.values(((await $.store.get(PEERS)) as Record<string, Peer> | undefined) ?? {})
    const now = await $.clock.now()
    if (all.length === 0) return { text: 'Сессия топилмади.' }
    const lines = all.map(
      (p) =>
        `${p.id === myId ? '→' : ' '} ${p.name} [${p.id.slice(0, 8)}] ${p.cwd} — ${
          now - p.seen < ALIVE_MS ? 'фаол' : 'номаълум'
        }`,
    )
    return { text: lines.join('\n') }
  })

  on('command.run', { command: 'tell' }, async ($, e) => {
    const [target, ...rest] = e.args.trim().split(/\s+/)
    const text = rest.join(' ')
    if (!target || !text) return { text: 'Фойдаланиш: /tell <ном|id> <матн>' }
    const all = Object.values(((await $.store.get(PEERS)) as Record<string, Peer> | undefined) ?? {}).filter((p) => p.id !== myId)
    const hit = all.filter((p) => p.name === target || p.id.startsWith(target))
    if (hit.length !== 1)
      return { text: hit.length === 0 ? `"${target}" топилмади. /sessions га қаранг.` : 'Номи бир нечта сессияга мос — id ишлатинг.' }
    const box = ((await $.store.get(INBOX)) as Msg[] | undefined) ?? []
    box.push({ id: `${await $.clock.now()}-${myId.slice(0, 4)}`, to: hit[0].id, from: myName, text, at: await $.clock.now() })
    await $.store.set(INBOX, box.slice(-200))
    return { text: `Юборилди → ${hit[0].name}` }
  })

  on('command.run', { command: 'inbox' }, async ($) => {
    await deliverNow?.()
    return { text: 'Хабарлар текширилди.' }
  })

  on('session.end', async ($, e, next) => {
    const all = ((await $.store.get(PEERS)) as Record<string, Peer> | undefined) ?? {}
    delete all[myId]
    await $.store.set(PEERS, all)
    return next(e)
  })
}

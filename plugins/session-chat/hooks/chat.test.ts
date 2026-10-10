import { test, expect, mock } from 'claude-code/testing'

test('tell needs target and text', async ($) => {
  const r = await $.command.run({ command: 'tell', args: 'x' })
  expect(r.text).toContain('Фойдаланиш')
})

test('tell unknown target is reported', async ($, on) => {
  mock.store(on, {})
  const r = await $.command.run({ command: 'tell', args: 'yoq-session salom' })
  expect(r.text).toContain('топилмади')
})

test('tell queues message for a known peer', async ($, on) => {
  mock.clock(on, { now: 1000 })
  mock.store(on, {
    peers: { abc12345: { id: 'abc12345', name: 'quruvchi', cwd: '/x', seen: 0 } },
  })
  const r = await $.command.run({ command: 'tell', args: 'quruvchi reja tayyor' })
  expect(r.text).toContain('Юборилди')
})

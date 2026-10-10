import { test, expect } from 'claude-code/testing'

test('route command reports state', async ($) => {
  const r = await $.command.run({ command: 'route', args: 'stats' })
  expect(r.text).toContain('Haiku')
})

import { test, expect } from 'claude-code/testing'

test('dashboard module registers its command', async ($) => {
  expect(typeof $.command.run).toBe('function')
})

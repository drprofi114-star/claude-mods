import type { AgentSpawnInput, CommandRunInput, On } from 'claude-code'
import { test, expect } from 'claude-code/testing'
import { pick } from './register'

// Engine'нинг $ чақирувлари ҳодисанинг тўлиқ кириш маълумотини олади
const cmd = (args: string): CommandRunInput => ({
  command: 'route',
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
})
const spawn = (e: { description: string; prompt: string; model?: string }): AgentSpawnInput => ({
  tool_use_id: 'toolu_test',
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'opus',
  background: false,
  fork: false,
  ...e,
})

test('route command reports state', async ($) => {
  const r = await $.command.run(cmd('stats'))
  expect(r.text).toContain('Haiku')
  expect(r.text).toContain('асосий сўров: ўчирилган')
})

test('route main on/off toggles main-prompt routing', async ($) => {
  expect((await $.command.run(cmd('main on'))).text).toContain('асосий сўров: ёқилган')
  expect((await $.command.run(cmd('main  off'))).text).toContain('асосий сўров: ўчирилган')
})

test('pick: stems match inflected English words', () => {
  expect(pick('summarize this file')).toBe('haiku')
  expect(pick('architecture review')).toBe('opus')
  expect(pick('database migration')).toBe('opus')
  expect(pick('concurrency bug')).toBe('opus')
  expect(pick('fix vulnerability')).toBe('opus')
  expect(pick('authentication flow')).toBe('opus')
  expect(pick('fix typo')).toBe('haiku')
})

test('pick: Cyrillic keywords match', () => {
  expect(pick('матнни таржима қилиб бер')).toBe('opus')
  expect(pick('шу бўлимни қайта ёзиб чиқ')).toBe('opus')
  expect(pick('қонун лойиҳасини таҳлил қил')).toBe('opus')
})

test('pick: translation and legal work never go to haiku', () => {
  expect(pick('translate the readme')).toBe('opus')
  expect(pick('format the legal memo')).toBe('opus')
})

test('pick: no false matches inside other words', () => {
  expect(pick('enlist the steps')).toBe(null)
  expect(pick('author of the book')).toBe('opus') // auth\p{L}* is a deliberate stem
  expect(pick('hello world')).toBe(null)
  expect(pick('x'.repeat(1600))).toBe('opus')
})

// Тест ҳуки плагин остида туради ва у узатган моделни ёзиб олади
const capture = (on: On) => {
  const seen: { model?: string } = {}
  on('agent.spawn', async (_$, e) => {
    seen.model = e.model
    return { model: e.model ?? 'inherit' }
  })
  return seen
}

test('agent.spawn routes by complexity', async ($, on) => {
  const seen = capture(on)
  await $.agent.spawn(spawn({ description: 'fix typo', prompt: 'Fix the typo in README' }))
  expect(seen.model).toBe('haiku')
})

test('agent.spawn routes hard work to opus', async ($, on) => {
  const seen = capture(on)
  await $.agent.spawn(spawn({ description: 'review', prompt: 'Do a security review of the auth module' }))
  expect(seen.model).toBe('opus')
})

test('agent.spawn keeps an explicit model', async ($, on) => {
  const seen = capture(on)
  await $.agent.spawn(spawn({ description: 'fix typo', prompt: 'fix typo', model: 'sonnet' }))
  expect(seen.model).toBe('sonnet')
})

test('agent.spawn leaves neutral tasks alone', async ($, on) => {
  const seen = capture(on)
  await $.agent.spawn(spawn({ description: 'hello', prompt: 'say hello' }))
  expect(seen.model).toBe(undefined)
})

test('route off stops subagent routing', async ($, on) => {
  const seen = capture(on)
  await $.command.run(cmd('off'))
  await $.agent.spawn(spawn({ description: 'fix typo', prompt: 'fix typo' }))
  expect(seen.model).toBe(undefined)
})

import type { Register } from 'claude-code'

const SIMPLE = /\b(typo|rename|readme|format|lint|list|grep|find|summar|comment|docstring|translate|licen[cs]e|bump|xato|nom(ini)?|таржима)\b/i
const HARD = /\b(refactor|architect|design|security|vulnerab|debug|race|concurren|migrat|rewrite|algorithm|payment|auth|performance|tizim|қайта\s*ёз)\b/i

export const register: Register = (on) => {
  let isOn = true
  const stats = { haiku: 0, opus: 0, kept: 0, main: 0 }
  let mainModel: string | null = null

  const pick = (prompt: string): 'haiku' | 'opus' | null => {
    const long = prompt.length > 1500
    if (HARD.test(prompt) || long) return 'opus'
    if (SIMPLE.test(prompt)) return 'haiku'
    return null
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'route', description: 'Модел тақсимоти: /route on|off|stats' })
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    if (!isOn || e.model) {
      stats.kept += 1
      return next(e)
    }
    const m = pick(`${e.description}\n${e.prompt}`)
    if (!m) {
      stats.kept += 1
      return next(e)
    }
    stats[m] += 1
    $.ui.status(`model-router: «${e.description.slice(0, 30)}» → ${m}`)
    return next({ ...e, model: m })
  })

  // Асосий сўров: оддий бўлса, шу навбат учун Haiku га йўналтирилади
  on('prompt.submit', async ($, e, next) => {
    mainModel = null
    if (isOn && !e.text.startsWith('/') && e.text.length < 400 && SIMPLE.test(e.text) && !HARD.test(e.text)) {
      mainModel = 'haiku'
      stats.main += 1
      $.ui.status('model-router: оддий сўров → haiku')
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (mainModel && e.agentId === undefined) return yield* next({ ...e, model: mainModel })
    return yield* next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!isOn) return r
    return {
      ...r,
      sections: [
        ...r.sections,
        {
          id: 'model-router:policy',
          scope: 'session',
          text:
            'Субагентга вазифа берганда Agent асбобининг model параметрини танла: оддий, механик ишлар (хатони тузатиш, ном ўзгартириш, README, форматлаш, қидирув) учун "haiku"; мураккаб ишлар (архитектура, хавфсизлик, қайта ёзиш, мураккаб дебаг) учун "opus". Бошқа ҳолда параметрни қолдир.',
        },
      ],
    }
  })

  on('command.run', { command: 'route' }, async ($, e) => {
    const a = e.args.trim()
    if (a === 'on') isOn = true
    else if (a === 'off') isOn = false
    return {
      text: `Модел тақсимоти: ${isOn ? 'ёқилган' : 'ўчирилган'}\nHaiku: ${stats.haiku} · Opus: ${stats.opus} · ўзгаришсиз: ${stats.kept} · асосий сўров (Haiku): ${stats.main}`,
    }
  })
}

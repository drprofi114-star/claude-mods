import type { Register } from 'claude-code'

// JS даги \b фақат лотин ҳарфларини сўз деб билади, шунинг учун кирилл сўзлар
// учун Unicode чегара ишлатилади. Ўзаклар \p{L}* билан тугайди: «summar» →
// «summarize», «migrat» → «migration».
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${list})(?![\\p{L}\\p{N}_])`, 'iu')

// Таржима ва ҳуқуқий матнлар атайлаб бу рўйхатда йўқ: улар Haiku'га тушмаслиги керак.
export const SIMPLE = words(
  'typo\\p{L}*|renam\\p{L}*|readme|format\\p{L}*|lint\\p{L}*|list|grep|find|summar\\p{L}*|comment\\p{L}*|docstring\\p{L}*|licen[cs]e|bump\\p{L}*|xato\\p{L}*|nom(?:ini)?',
)
export const HARD = words(
  'refactor\\p{L}*|architect\\p{L}*|design\\p{L}*|secur\\p{L}*|vulnerab\\p{L}*|debug\\p{L}*|race|concurren\\p{L}*|migrat\\p{L}*|rewrit\\p{L}*|algorithm\\p{L}*|payment\\p{L}*|auth\\p{L}*|performance|tizim\\p{L}*|қайта\\s*ёз\\p{L}*|таржим\\p{L}*|translat\\p{L}*|ҳуқуқ\\p{L}*|юридик\\p{L}*|қонун\\p{L}*|legal\\p{L}*',
)

export const pick = (prompt: string): 'haiku' | 'opus' | null => {
  if (HARD.test(prompt) || prompt.length > 1500) return 'opus'
  if (SIMPLE.test(prompt)) return 'haiku'
  return null
}

export const register: Register = (on) => {
  let isOn = true
  // Асосий сўровни Haiku'га ўтказиш хавфли, шунинг учун фақат «/route main on» билан ёқилади
  let mainOn = false
  const stats = { haiku: 0, opus: 0, kept: 0, main: 0 }
  let mainModel: string | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'route', description: 'Модел тақсимоти: /route on|off|stats|main on|main off' })
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

  on('prompt.submit', async ($, e, next) => {
    // Ишлаб турган навбатга келган хабар (turnId бор) ўша навбатнинг моделини ўзгартирмайди
    if (e.turnId !== undefined) return next(e)
    mainModel = null
    if (isOn && mainOn && !e.text.startsWith('/') && e.text.length < 400 && pick(e.text) === 'haiku') {
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
            'Субагентга вазифа берганда Agent асбобининг model параметрини танла: оддий, механик ишлар (хатони тузатиш, ном ўзгартириш, README, форматлаш, қидирув) учун "haiku"; мураккаб ишлар (архитектура, хавфсизлик, қайта ёзиш, мураккаб дебаг, таржима, ҳуқуқий матнлар) учун "opus". Бошқа ҳолда параметрни қолдир.',
        },
      ],
    }
  })

  on('command.run', { command: 'route' }, async ($, e) => {
    const a = e.args.trim().replace(/\s+/g, ' ')
    if (a === 'on') isOn = true
    else if (a === 'off') isOn = false
    else if (a === 'main on') mainOn = true
    else if (a === 'main off') {
      mainOn = false
      mainModel = null
    }
    return {
      text:
        `Модел тақсимоти: ${isOn ? 'ёқилган' : 'ўчирилган'} · асосий сўров: ${mainOn ? 'ёқилган' : 'ўчирилган'}\n` +
        `Haiku: ${stats.haiku} · Opus: ${stats.opus} · ўзгаришсиз: ${stats.kept} · асосий сўров (Haiku): ${stats.main}`,
    }
  })
}

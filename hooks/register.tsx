import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snap } from '../types'

const PANE = 'limits-panel'
const snap = atom({ plugin: 'limits-panel', key: 'snap' } as const, null, { shape: 'snap-1' })
// История процента 5-часового окна для мини-графика
const history = atom({ plugin: 'limits-panel', key: 'history' } as const, [], { shape: 'hist-1' })

const NAMES: Record<string, string> = {
  five_hour: '5-часовой лимит',
  seven_day: 'Недельный лимит',
  spend_limit: 'Лимит расходов',
}
const BLOCKS = '▁▂▃▄▅▆▇█'

const bar = (p: number, w = 20) => {
  const n = Math.round((Math.min(100, Math.max(0, p)) / 100) * w)
  return '█'.repeat(n) + '░'.repeat(w - n)
}
const tone = (p: number) => (p >= 90 ? 'error' : p >= 70 ? 'warning' : 'success')
const fmtN = (n?: number) =>
  n === undefined ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return 'сейчас сбросится'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const hh = Math.floor((m % 1440) / 60)
  const mm = m % 60
  return 'сброс через ' + (d ? `${d} д ` : '') + (hh ? `${hh} ч ` : '') + `${mm} мин`
}
// Короткий формат: 2д 3ч / 1ч 20м / 45м
const left = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(m / 1440)
  const hh = Math.floor((m % 1440) / 60)
  const mm = m % 60
  return d ? `${d}д ${hh}ч` : hh ? `${hh}ч ${mm}м` : `${mm}м`
}
const spark =(xs: number[]) =>
  xs.map(x => BLOCKS[Math.min(7, Math.floor((x / 100) * 8))]).join('')

async function capture($: any, e: any) {
  const u = e ?? (await $.session.usage())
  const s: Snap = {
    limits: u.rateLimits,
    contextPercent: u.context.percent,
    contextTokens: u.context.tokens,
    contextWindow: u.context.window,
    usd: u.cost?.usd,
    at: await $.clock.now(),
  }
  await update($, snap, () => s)
  const five = u.rateLimits.find((r: any) => r.kind === 'five_hour')
  if (five) await update($, history, (xs: number[]) => [...xs, five.percentUsed].slice(-40))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await capture($, undefined)
    return next(e)
  })
  on('session.measure', async ($, e, next) => {
    await capture($, e)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const short: Record<string, string> = { five_hour: '5ч', seven_day: 'нед', spend_limit: '$' }

    return (
      <Box justifyContent="space-between" width="100%">
        {s.limits.map(l => (
          <Box>
            <Text color="text">{short[l.kind] ?? l.kind} </Text>
            <Text color={tone(l.percentUsed)}>{bar(l.percentUsed, 10)}</Text>
            <Text color="text">
              {' '}{l.percentUsed}%{l.resetsAt ? ` ⟳${left(l.resetsAt, s.at)}` : ''}
            </Text>
          </Box>
        ))}
        <Box>
          <Text color="text">контекст </Text>
          <Text color={tone(s.contextPercent ?? 0)}>{bar(s.contextPercent ?? 0, 10)}</Text>
          <Text color="text"> {s.contextPercent ?? 0}%</Text>
        </Box>
        <Text color="text">
          {s.limits.length === 0 ? 'лимиты недоступны  ' : ''}
          {s.usd === undefined ? '' : `$${s.usd.toFixed(2)}`}
        </Text>
      </Box>
    )
  })
}

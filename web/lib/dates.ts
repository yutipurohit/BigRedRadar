import type { EventItem } from './types'

export const ITHACA = 'America/New_York'
export const STRIP_DAYS = 21

export const fmtTime = new Intl.DateTimeFormat('en-US', { timeZone: ITHACA, hour: 'numeric', minute: '2-digit' })
export const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: ITHACA, year: 'numeric', month: '2-digit', day: '2-digit' })
export const fmtWkShort = new Intl.DateTimeFormat('en-US', { timeZone: ITHACA, weekday: 'short' })
export const fmtWkLong = new Intl.DateTimeFormat('en-US', { timeZone: ITHACA, weekday: 'long' })
export const fmtMonth = new Intl.DateTimeFormat('en-US', { timeZone: ITHACA, month: 'long' })

export function dayKeys(count: number) {
  const [y, m, d] = fmtKey.format(new Date()).split('-').map(Number)
  const noon = Date.UTC(y, m - 1, d, 16)
  const keys: string[] = []

  for (let i = 0; i < count; i++) {
    keys.push(fmtKey.format(new Date(noon + i * 86400000)))
  }

  return keys
}

export function keyToDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 16))
}

export function matches(e: EventItem, q: string) {
  return (e.title || '').toLowerCase().includes(q)
    || (e.org_name || '').toLowerCase().includes(q)
    || (e.location || '').toLowerCase().includes(q)
}

function utcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function ymd(d: Date) {
  return fmtKey.format(d).replace(/-/g, '')
}

export function gcalUrl(e: EventItem) {
  const start = new Date(e.starts_at)
  const hour = 60 * 60 * 1000

  let dates: string

  if (e.all_day) {
    const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 24 * hour)
    dates = `${ymd(start)}/${ymd(end)}`
  } else {
    const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + hour)
    dates = `${utcStamp(start)}/${utcStamp(end)}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.org_name ? `${e.title} (${e.org_name})` : e.title,
    dates,
    details: [e.description || '', e.url ? `\n\n${e.url}` : ''].join('').trim(),
    location: e.location || '',
    ctz: ITHACA,
  })

  return 'https://calendar.google.com/calendar/render?' + params.toString()
}
